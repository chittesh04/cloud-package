# Architecture and Demonstration Guide

## 1. Project purpose

**Hybrid Cloud Architecture Design for a Scalable College Application** separates high-traffic student services from sensitive academic and financial information.

- The **public cloud** represents scalable, student-facing workloads: admission, course registration, e-learning materials and sign-in.
- The **private cloud** represents protected workloads: academic records, examination results and financial records.
- The **hybrid cloud** is the controlled connection between those environments. It permits the public gateway to request a student's authorized sensitive data without exposing the private API or private database to the browser.

## 2. Local deployment topology

```text
 Browser
   |
   v :8080
+----------------------+       public_net
| Nginx reverse proxy  |------------------------------+
| load balancer        |                              |
+----------+-----------+                              v
           |                                  +-------------------+
           +--------------------------------->| public-api (1..N) |
                                              | auth/admission/   |
                                              | courses/materials |
                                              +--+-------------+--+
                                                 |             |
                                                public_net  hybrid_net (internal)
                                                 |             |
                                                 v             v
                                          +-------------+ +------------------+
                                          | public-db   | | private-api      |
                                          +-------------+ | academic/finance |
                                                          +--------+---------+
                                                                   |
                                                         private_net (internal)
                                                                   |
                                                                   v
                                                            +-------------+
                                                            | private-db  |
                                                            +-------------+
```

Only Nginx publishes a host port. `private-api` and `private-db` have no host port and are on internal Docker networks. This is a practical local representation of the abstract's secure API/VPN-like hybrid connection.

## 3. Workload distribution

| Component | Deployment model | Why |
| --- | --- | --- |
| Admission portal | Public cloud | Handles peak applicant traffic without accessing private data. |
| Course registration | Public cloud | Student-facing, scalable workload. |
| E-learning | Public cloud | High-read, high-concurrency content access. |
| Authentication/API gateway | Public cloud edge | Validates student JWT before routing sensitive requests. |
| Academic records | Private cloud | Marks and grades are sensitive student data. |
| Finance records | Private cloud | Fees and transactions are sensitive financial data. |
| Nginx | Load balancer/API entry point | Routes browser traffic only to public API replicas. |
| Admin dashboard | Public dashboard, admin protected | Centralized monitoring of requests, health and configured capacity. |

## 4. Secure sensitive-data flow

```text
Student signs in -> public API verifies password -> JWT returned
Student requests /api/academics -> Nginx -> public API validates JWT
public API creates a 60-second internal service JWT with subject/role
public API -> private API over internal hybrid_net -> private PostgreSQL
private API verifies internal JWT and ownership -> authorized data returns
```

The private API refuses ordinary browser requests because it requires `X-Hybrid-Service-Token`, signed with a separate internal secret. A student token permits only that student's records; an admin context can be extended for managed record views. This prototype uses shared HMAC secrets for clarity. A production system should use mTLS, a secret manager, key rotation, a managed identity provider, rate limits, audit logs and network firewall policy.

## 5. Database design

The **public database** has `students`, `admissions`, `courses`, `registrations`, and `materials`. The **private database** has `academic_records` and `financial_records`. They are intentionally separate PostgreSQL databases. The private schema refers to the public student ID as a logical identifier; it has no cross-database foreign key, which reflects independent cloud data stores.

The SQL initialization files contain courses, e-learning materials, academic records and financial records. The public API creates/upserts demo accounts at startup, hashing their passwords with Werkzeug's password-hashing function.

## 6. Endpoint summary

| Method | Path through Nginx | Security | Workload |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Credentials | Public |
| POST | `/api/auth/register` | Public account creation | Public |
| POST | `/api/admissions` | Public form | Public |
| GET | `/api/courses`, `/api/materials` | Student JWT | Public |
| POST | `/api/registrations` | Student JWT | Public |
| GET | `/api/academics`, `/api/finance` | Student JWT + hybrid service JWT | Private through gateway |
| GET | `/api/admin/metrics` | Admin JWT | Monitoring |

## 7. Cloud bursting demonstration

1. Start the stack with one `public-api` replica and sign in as admin in the browser.
2. In a second terminal, run `py scripts/load_test.py --requests 100 --concurrency 20`.
3. Refresh the monitoring dashboard to show increased public traffic.
4. Simulate an admission deadline/result-publication peak:

   ```powershell
   $env:PUBLIC_REPLICAS=3
   docker compose up -d --scale public-api=3
   ```

5. Run `py scripts/load_test.py --requests 300 --concurrency 40`. Its `X-Public-Service` distribution shows requests handled by multiple replicas.
6. Explain that a production orchestration platform would scale based on metrics. Here, the manual replica command makes the scaling effect deterministic and easy to demonstrate.

## 8. Suggested presentation sequence

1. Open the student portal and identify the public/private/hybrid cards.
2. Submit an admission form (public cloud).
3. Register a course and open e-learning material (public cloud).
4. Open Private records and explain that the browser never contacts the private database.
5. Sign in as admin and open monitoring.
6. Run the normal load script, then increase replicas and repeat it.
7. Point to the Nginx configuration and Docker networks as evidence of load balancing and private network isolation.

## 9. Optional AWS mapping (not deployed by this repository)

This repository does **not** create AWS resources or claim an AWS deployment. If extending it later:

| Local component | Possible AWS equivalent |
| --- | --- |
| Nginx | Application Load Balancer + API Gateway |
| public-api replicas | ECS/Fargate service or EKS deployment with autoscaling |
| public-db/private-db | Separate RDS PostgreSQL instances/subnets |
| `hybrid_net` | VPC peering, Transit Gateway, Site-to-Site VPN or PrivateLink (chosen to fit the real network) |
| Manual scale command | ECS Service Auto Scaling / Kubernetes HPA driven by CloudWatch metrics |
| Monitoring dashboard | CloudWatch dashboards, logs and alarms |

Before any AWS deployment, move secrets to AWS Secrets Manager, use IAM roles and TLS, restrict security groups, enable backups/audit logging, and apply a privacy review for student data.
