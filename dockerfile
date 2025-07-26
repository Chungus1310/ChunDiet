FROM python:3.9-slim-buster AS base

ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc


FROM base AS builder

RUN pip install --upgrade pip

COPY backend/requirements.txt/requirements.txt .

RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt gunicorn


FROM base AS final

COPY --from=builder /app/wheels /wheels

RUN pip install --no-cache /wheels/*

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:$PORT", "backend.app.app:app"]
