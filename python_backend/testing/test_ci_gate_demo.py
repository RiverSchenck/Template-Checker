# Deliberately failing test: shows that a red test suite blocks deploys. Reverted in the next commit.
def test_deliberate_failure():
    assert False, 'deliberate failure to prove the deploy gate'
