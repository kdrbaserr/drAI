# AWS ECS/Fargate Deployment

The backend is deployed as a Docker image built by GitHub Actions, stored in
Amazon ECR, and run as an ECS Fargate service behind an Application Load
Balancer (ALB).

## AWS Resources

Create these resources in one AWS region:

1. An ECR repository, for example `drai-api`.
2. A CloudWatch Logs log group named `/ecs/drai-api`.
3. Three AWS Secrets Manager secrets:
   - `drai/DATABASE_URL`
   - `drai/HF_TOKEN`
   - `drai/JWT_SECRET_KEY`
4. An ECS task execution role with permissions for ECR image pulls,
   CloudWatch logs, and reading the three Secrets Manager secrets.
5. An ECS task role for the application container. It can have no additional
   permissions unless application features later require AWS API access.
6. An ECS Fargate cluster and service using port `8000`.
7. An ALB target group configured for port `8000` and health check path
   `/health`.

The task definition template is in `aws/ecs-task-definition.json`.

## GitHub Repository Settings

Under `Settings > Secrets and variables > Actions`, define these repository
secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
ECR_REPOSITORY
ECS_CLUSTER
ECS_SERVICE
ECS_EXECUTION_ROLE_ARN
ECS_TASK_ROLE_ARN
DATABASE_URL_SECRET_ARN
HF_TOKEN_SECRET_ARN
JWT_SECRET_KEY_SECRET_ARN
```

Define this repository variable:

```text
CORS_ORIGINS
```

Set `CORS_ORIGINS` to the deployed frontend origin, for example:

```text
https://your-frontend.example.com
```

## Deployment

The workflow at `.github/workflows/deploy.yml` runs on pushes to `main`.
It builds the image, pushes immutable and `latest` tags to ECR, renders the
task definition, and updates the ECS service.

The database is already migrated through revision `0001_create_audit_logs`.
For future database revisions, run Alembic as a one-off ECS task before
rolling application tasks that depend on the new schema:

```bash
python -m alembic -c alembic.ini upgrade head
```

## Public Smoke Test

Once the ALB or custom domain URL is public, run:

```bash
python backend/scripts/smoke_test_public.py https://your-api-url
```

The script verifies health, model info, auth protection, registration/login,
database access, ECG and EEG analysis endpoints, history/results, and invalid
file rejection.
