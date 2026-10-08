FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_DISABLE_PIP_VERSION_CHECK=1
ENV NOWHERE_HOME=/data HOME=/data XDG_DATA_HOME=/data/.local/share XDG_CACHE_HOME=/data/.cache
WORKDIR /app
COPY pyproject.toml README.md ./
COPY nowhere/ ./nowhere/
COPY deploy/secured_mcp.py ./deploy/secured_mcp.py
RUN pip install --no-cache-dir -e . && useradd -r -u 10001 -m nowhere && mkdir -p /data && chown nowhere:nowhere /data
USER 10001:10001
EXPOSE 8765
CMD ["python", "-m", "deploy.secured_mcp"]
