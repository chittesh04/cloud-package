# Hybrid Cloud College Application

A runnable college-project prototype for **Hybrid Cloud Architecture Design for a Scalable College Application**. It demonstrates public-cloud student services, a private-cloud records service, a secure hybrid connection, JWT authentication, Nginx load balancing, PostgreSQL, monitoring, and manual cloud bursting.

> This is a local Docker simulation, not an AWS deployment. The public and private Docker networks model the public cloud, private cloud, and their secured hybrid connection.

## What is included

| Area | Demonstration |
| --- | --- |
| Public cloud | Admission applications, course registration, e-learning materials |
| Private cloud | Academic records and financial records in a database unreachable from the browser |
| Hybrid cloud | Public API forwards authenticated, short-lived internal JWT context to the private API over `hybrid_net` |
| Security | Password hashing, JWT, student ownership checks, admin-only monitoring, internal service token |
| Scalability | Nginx load balances public API replicas; Docker scaling simulates cloud bursting |
| Monitoring | Admin dashboard shows requests, private calls, errors, service status and configured public replicas |

## Quick start

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it.
2. In this folder, copy the environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

3. Start the prototype:

   ```powershell
   docker compose up --build
   ```

4. Open [http://localhost:8080](http://localhost:8080).

Use either demo account:

| Role | Email | Password |
| --- | --- | --- |
| Student | `student@college.edu` | `Student@123` |
| Admin | `admin@college.edu` | `Admin@123` |

Stop it with `docker compose down`. Add `-v` only when you deliberately want to remove the seeded database volumes.

## Demo script

With the stack running, install the one small client dependency and run:

```powershell
py -m pip install -r scripts/requirements.txt
py scripts/load_test.py --requests 100 --concurrency 20
```

On machines where `py` is unavailable, use your installed `python` command instead. The script sends public e-learning requests, prints latency and observes which public replicas handled traffic through the `X-Public-Service` response header.

To simulate **cloud bursting**, in a second terminal run:

```powershell
$env:PUBLIC_REPLICAS=3
docker compose up -d --scale public-api=3
py scripts/load_test.py --requests 300 --concurrency 40
```

Refresh the Admin dashboard and observe `configuredPublicReplicas`, rising request counts, and the request distribution. Return to normal capacity with:

```powershell
$env:PUBLIC_REPLICAS=1
docker compose up -d --scale public-api=1
```

## Architecture and API guide

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the deployment model, security boundaries, data design, endpoint list, demo sequence, and optional AWS mapping.

## Repository layout

```text
frontend/              Student and admin web interface
services/public-api/   Public-cloud API: auth, admissions, courses, materials, gateway
services/private-api/  Private-cloud API: academic and finance records
database/public/       PostgreSQL schema and demo data for public workloads
database/private/      PostgreSQL schema and demo data for sensitive workloads
gateway/               Nginx reverse proxy and load balancer
scripts/               Load-test/demo utility
docs/                  Architecture documentation
docker-compose.yml     Local hybrid-cloud topology
```

## Important project limitations

- The internal Docker network and service JWT **model** a VPN/private link; they are not a substitute for production mTLS, managed secrets, firewall rules, backups, audit logging, or a real identity provider.
- Compose does not autoscale itself. The documented `--scale` command is an intentional, visible cloud-bursting simulation for the project demonstration.
- Change all credentials and secrets before exposing any deployment beyond a local demo.
