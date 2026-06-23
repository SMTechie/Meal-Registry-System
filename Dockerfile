FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000 3001
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["gunicorn", "meal_registry.wsgi:application", "--bind", "0.0.0.0:3000", "--workers", "3"]
