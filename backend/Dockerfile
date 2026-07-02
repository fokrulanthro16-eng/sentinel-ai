FROM python:3.11-slim

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 sentinel && \
    adduser --system --uid 1001 --ingroup sentinel sentinel

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Give app directory correct ownership
RUN chown -R sentinel:sentinel /app

USER sentinel

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
