"""Send authenticated public-cloud traffic through Nginx for the scaling demo."""
import argparse
import concurrent.futures
import statistics
import time
from collections import Counter

import requests


def main():
    parser = argparse.ArgumentParser(description="Hybrid-cloud public API load demonstration")
    parser.add_argument("--base-url", default="http://localhost:8080", help="Nginx URL")
    parser.add_argument("--requests", type=int, default=100, help="Total public requests")
    parser.add_argument("--concurrency", type=int, default=20, help="Parallel requests")
    args = parser.parse_args()

    login = requests.post(f"{args.base_url}/api/auth/login", json={"email": "student@college.edu", "password": "Student@123"}, timeout=10)
    login.raise_for_status()
    headers = {"Authorization": f"Bearer {login.json()['token']}"}

    def hit(_):
        started = time.perf_counter()
        try:
            response = requests.get(f"{args.base_url}/api/materials", headers=headers, timeout=15)
            return response.status_code, response.headers.get("X-Public-Service", "unknown"), (time.perf_counter() - started) * 1000
        except requests.RequestException:
            return 0, "request-failed", (time.perf_counter() - started) * 1000

    started = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(hit, range(args.requests)))
    elapsed = time.perf_counter() - started
    statuses = Counter(status for status, _, _ in results)
    instances = Counter(instance for _, instance, _ in results)
    latencies = [latency for _, _, latency in results]
    print("Hybrid Cloud Load Demonstration")
    print(f"Requests: {args.requests} | Concurrency: {args.concurrency} | Elapsed: {elapsed:.2f}s | Throughput: {args.requests/elapsed:.1f} req/s")
    print(f"Status codes: {dict(statuses)}")
    print(f"Latency: avg {statistics.mean(latencies):.1f}ms, p95 {sorted(latencies)[max(0, int(len(latencies)*.95)-1)]:.1f}ms")
    print("Nginx distribution (X-Public-Service):")
    for instance, count in instances.most_common():
        print(f"  {instance}: {count} requests")
    if len(instances) > 1:
        print("Result: requests were distributed across public-cloud replicas.")
    else:
        print("Result: one public replica observed. Run `docker compose up -d --scale public-api=3` and repeat to demonstrate cloud bursting.")


if __name__ == "__main__":
    main()
