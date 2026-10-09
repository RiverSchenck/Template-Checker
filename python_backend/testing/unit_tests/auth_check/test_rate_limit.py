import pytest
import app.rate_limit as rate_limit
import app.routes as routes

USER = {'Authorization': 'Bearer valid-approved@example.com'}
OTHER_USER = {'Authorization': 'Bearer valid-other@example.com'}


def create_key(client):
    r = client.post('/api-keys', json={'name': 'CI'}, headers=USER)
    assert r.status_code == 201
    return r.get_json()['key']


# --- limiter primitives ---------------------------------------------------------------------------------------------

def test_hit_allows_up_to_limit_within_window(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(rate_limit.time, 'time', lambda: now[0])
    assert [rate_limit.hit('b', 3, 60)[0] for _ in range(3)] == [True, True, True]
    allowed, retry_after = rate_limit.hit('b', 3, 60)
    assert not allowed and 1 <= retry_after <= 61

    now[0] += 61  # the window slides past the earlier hits
    assert rate_limit.hit('b', 3, 60)[0]


def test_rejected_hits_are_not_counted(monkeypatch):
    now = [1000.0]
    monkeypatch.setattr(rate_limit.time, 'time', lambda: now[0])
    rate_limit.hit('b', 1, 60)
    now[0] += 30
    assert not rate_limit.hit('b', 1, 60)[0]
    now[0] += 31  # 61s after the only counted hit
    assert rate_limit.hit('b', 1, 60)[0]


def test_buckets_are_independent():
    assert rate_limit.hit('a', 1, 60)[0]
    assert rate_limit.hit('b', 1, 60)[0]
    assert not rate_limit.hit('a', 1, 60)[0]


def test_lock_is_exclusive_until_released():
    first = rate_limit.acquire('user-1')
    assert first is not None
    assert rate_limit.acquire('user-1') is None
    assert rate_limit.acquire('user-2') is not None
    rate_limit.release(first)
    assert rate_limit.acquire('user-1') is not None


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


def test_limiter_failure_lets_checks_through(client, monkeypatch):
    def broken(*a, **k):
        raise OSError('disk full')
    monkeypatch.setattr(rate_limit, 'acquire', broken)
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
