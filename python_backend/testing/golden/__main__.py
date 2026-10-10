import argparse
import os
import sys

from testing.golden.golden import RESULTS_DIR, golden_path, load, packages, run, save


def main():
    parser = argparse.ArgumentParser(description='Compare or update golden checker results.')
    parser.add_argument('--update', action='store_true', help='rewrite stored results to match the current code')
    args = parser.parse_args()

    current = packages()
    changed = []
    for package in current:
        actual = run(package)
        if load(package) != actual:
            changed.append(package)
            if args.update:
                save(package, actual)

    # Drop results for packages that no longer exist.
    expected_files = {golden_path(p) for p in current}
    stale = [os.path.join(root, f) for root, _, files in os.walk(RESULTS_DIR) for f in files
             if f.endswith('.json') and os.path.join(root, f) not in expected_files]
    if args.update:
        for path in stale:
            os.remove(path)

    verb = 'Updated' if args.update else 'Differs'
    for package in changed:
        print(f'{verb}: {package}')
    for path in stale:
        print(f"{'Removed' if args.update else 'Stale'}: {os.path.relpath(path, RESULTS_DIR)}")
    print(f'{len(current)} packages, {len(changed)} changed, {len(stale)} stale.')
    return 1 if (changed or stale) and not args.update else 0


if __name__ == '__main__':
    sys.exit(main())
