import pytest
import app.rate_limit as rate_limit
import app.routes as routes

USER = {'Authorization': 'Bearer valid-approved@example.com'}
OTHER_USER = {'Authorization': 'Bearer valid-other@example.com'}


def create_key(client):
    r = client.post('/api-keys', json={'name': 'CI'}, headers=USER)
    assert r.status_code == 201
    return r.get_json()['key']


# --- Supabase wrapper ------------------------------------------------------------------------------------------------

REAL_RPC = rate_limit._rpc  # captured before the autouse fake replaces it


class RecordingSupabase:
    def __init__(self, data):
        self.data, self.calls = data, []

    def rpc(self, name, params):
        self.calls.append((name, params))
        return self

    def execute(self):
        return type('R', (), {'data': self.data})


def test_rpc_calls_supabase_function(monkeypatch):
    sb = RecordingSupabase([{'allowed': True, 'retry_after_seconds': 0}])
    monkeypatch.setattr(rate_limit, '_rpc', REAL_RPC)
    monkeypatch.setattr(rate_limit, 'get_supabase_client', lambda: sb)
    assert rate_limit.hit('checks:user:1', 50, 3600) == (True, 0)
    assert sb.calls == [('rate_limit_hit', {'p_bucket': 'checks:user:1', 'p_limit': 50, 'p_window_seconds': 3600})]


def test_rpc_without_supabase_is_unavailable(monkeypatch):
    monkeypatch.setattr(rate_limit, '_rpc', REAL_RPC)
    monkeypatch.setattr(rate_limit, 'get_supabase_client', lambda: None)
    with pytest.raises(rate_limit.LimiterUnavailable):
        rate_limit.hit('b', 1, 60)
    with pytest.raises(rate_limit.LimiterUnavailable):
        rate_limit.acquire('b')


@pytest.mark.parametrize('data, expected', [
    ([{'allowed': False, 'retry_after_seconds': 42}], (False, 42)),
    ({'allowed': True, 'retry_after_seconds': None}, (True, 0)),
])
def test_hit_parses_response_shapes(monkeypatch, data, expected):
    monkeypatch.setattr(rate_limit, '_rpc', lambda name, params: data)
    assert rate_limit.hit('b', 1, 60) == expected


@pytest.mark.parametrize('data', [[], None])
def test_hit_with_no_row_is_unavailable(monkeypatch, data):
    monkeypatch.setattr(rate_limit, '_rpc', lambda name, params: data)
    with pytest.raises(rate_limit.LimiterUnavailable):
        rate_limit.hit('b', 1, 60)


def test_lease_is_exclusive_until_released(fake_limiter):
    first = rate_limit.acquire('user-1')
    assert first is not None
    assert rate_limit.acquire('user-1') is None
    assert rate_limit.acquire('user-2') is not None
    rate_limit.release(first)
    assert rate_limit.acquire('user-1') is not None


def test_stale_lease_expires(fake_limiter):
    assert rate_limit.acquire('user-1') is not None  # holder never releases (e.g. worker killed)
    fake_limiter.now += rate_limit.LEASE_TTL_SECONDS
    assert rate_limit.acquire('user-1') is not None


def test_release_never_raises(monkeypatch):
    def broken(name, params):
        raise RuntimeError('network down')
    monkeypatch.setattr(rate_limit, '_rpc', broken)
    rate_limit.release(('user-1', 'lease'))


# --- checks per hour ------------------------------------------------------------------------------------------------

def test_50th_check_allowed_51st_rejected(client):
    for _ in range(routes.CHECKS_PER_HOUR):
        assert client.post('/run', headers=USER).status_code == 200
    r = client.post('/run', headers=USER)
    assert r.status_code == 429
    assert r.get_json()['error']['code'] == 'rate_limited'
    assert int(r.headers['Retry-After']) > 0
    assert len(client.run_calls) == routes.CHECKS_PER_HOUR


def test_browser_and_api_key_share_the_same_quota(client):
    key = create_key(client)
    for i in range(routes.CHECKS_PER_HOUR):
        headers = USER if i % 2 else {'Authorization': f'Bearer {key}'}
        assert client.post('/run', headers=headers).status_code == 200
    assert client.post('/run-and-download-xml', headers={'Authorization': f'Bearer {key}'}).status_code == 429
    assert client.post('/run', headers=USER).status_code == 429


def test_quota_is_per_user(client):
    for _ in range(routes.CHECKS_PER_HOUR):
        client.post('/run', headers=USER)
    assert client.post('/run', headers=USER).status_code == 429
    assert client.post('/run', headers=OTHER_USER).status_code == 200


def test_unauthenticated_requests_do_not_use_quota(client):
    for _ in range(routes.CHECKS_PER_HOUR + 5):
        assert client.post('/run').status_code == 401
    assert client.post('/run', headers=USER).status_code == 200


# --- one check at a time --------------------------------------------------------------------------------------------

@pytest.mark.parametrize('path', ['/run', '/run-and-download-xml'])
def test_second_concurrent_check_is_rejected_without_using_quota(client, path):
    held = rate_limit.acquire('checks:user:user-1')  # simulate a check in progress in another worker
    try:
        r = client.post(path, headers=USER)
        assert r.status_code == 429
        assert r.get_json()['error']['code'] == 'check_in_progress'
        assert client.post(path, headers=OTHER_USER).status_code != 429
    finally:
        rate_limit.release(held)
    assert client.run_calls[0]['user_id'] == 'user-2'  # only the other user's check ran


def test_lock_is_released_after_a_check(client):
    assert client.post('/run', headers=USER).status_code == 200
    assert client.post('/run', headers=USER).status_code == 200


def test_lock_is_released_when_the_check_crashes(client, monkeypatch):
    def crash(*a, **k):
        raise RuntimeError('boom')
    monkeypatch.setattr(routes, 'start_check', crash)
    assert client.post('/run', headers=USER).status_code == 500
    lock = rate_limit.acquire('checks:user:user-1')
    assert lock is not None
    rate_limit.release(lock)


@pytest.mark.parametrize('failing', ['acquire', 'hit'])
def test_limiter_failure_lets_checks_through(client, monkeypatch, failing):
    def broken(*a, **k):
        raise rate_limit.LimiterUnavailable('supabase down')
    monkeypatch.setattr(rate_limit, failing, broken)
    assert client.post('/run', headers=USER).status_code == 200


def test_limiter_failure_lets_access_requests_through(client, monkeypatch):
    def broken(*a, **k):
        raise rate_limit.LimiterUnavailable('supabase down')
    monkeypatch.setattr(rate_limit, 'hit', broken)
    monkeypatch.setattr(routes, 'get_supabase_client', lambda: None)
    assert client.post('/access-requests', json={'email': 'a@b.com'}).status_code == 503


def test_hourly_window_slides(client, fake_limiter):
    for _ in range(routes.CHECKS_PER_HOUR):
        client.post('/run', headers=USER)
    r = client.post('/run', headers=USER)
    assert r.status_code == 429 and int(r.headers['Retry-After']) == 3600
    fake_limiter.now += 3600
    assert client.post('/run', headers=USER).status_code == 200


# --- access requests ------------------------------------------------------------------------------------------------

def test_access_requests_are_limited_per_ip(client, monkeypatch):
    monkeypatch.setattr(routes, 'get_supabase_client', lambda: None)  # past the limiter -> 503, no DB needed
    for _ in range(routes.ACCESS_REQUESTS_PER_HOUR_PER_IP):
        r = client.post('/access-requests', json={'email': 'a@b.com'}, environ_base={'REMOTE_ADDR': '1.1.1.1'})
        assert r.status_code == 503
    r = client.post('/access-requests', json={'email': 'a@b.com'}, environ_base={'REMOTE_ADDR': '1.1.1.1'})
    assert r.status_code == 429
    assert 'Retry-After' in r.headers
    r = client.post('/access-requests', json={'email': 'a@b.com'}, environ_base={'REMOTE_ADDR': '2.2.2.2'})
    assert r.status_code == 503


def test_fly_client_ip_used_only_when_running_on_fly(client, monkeypatch):
    monkeypatch.setattr(routes, 'get_supabase_client', lambda: None)

    def post(ip):
        return client.post('/access-requests', json={'email': 'a@b.com'},
                           headers={'Fly-Client-IP': ip}, environ_base={'REMOTE_ADDR': '10.0.0.1'})

    # Not on Fly: the header is ignored (it could be spoofed), so all requests share the proxy address.
    monkeypatch.delenv('FLY_APP_NAME', raising=False)
    for i in range(routes.ACCESS_REQUESTS_PER_HOUR_PER_IP):
        post(f'9.9.9.{i}')
    assert post('9.9.9.99').status_code == 429

    # On Fly: each real client IP gets its own allowance.
    monkeypatch.setenv('FLY_APP_NAME', 'template-checker-test')
    assert post('8.8.8.8').status_code == 503
