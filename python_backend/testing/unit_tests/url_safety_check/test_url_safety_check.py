import socket
import pytest
from app.utils import assert_public_url, UnsafeURLError


def _resolve_to(monkeypatch, ip):
    family = socket.AF_INET6 if ':' in ip else socket.AF_INET
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *a, **k: [(family, socket.SOCK_STREAM, 6, '', (ip, 443))])


@pytest.mark.parametrize('ip', [
    '127.0.0.1',        # loopback
    '10.0.0.5',         # private
    '192.168.1.1',      # private
    '169.254.169.254',  # cloud metadata
    'fdaa::3',          # Fly.io private network
    '::1',              # IPv6 loopback
    '::ffff:127.0.0.1', # IPv4-mapped loopback
])
def test_blocks_internal_addresses(monkeypatch, ip):
    _resolve_to(monkeypatch, ip)
    with pytest.raises(UnsafeURLError):
        assert_public_url('https://example.com/file.zip')


def test_allows_public_address(monkeypatch):
    _resolve_to(monkeypatch, '93.184.216.34')
    assert_public_url('https://example.com/file.zip')


@pytest.mark.parametrize('url', ['file:///etc/passwd', 'ftp://example.com/a.zip', 'https:///nohost', ''])
def test_blocks_bad_schemes_and_hosts(url):
    with pytest.raises(UnsafeURLError):
        assert_public_url(url)
