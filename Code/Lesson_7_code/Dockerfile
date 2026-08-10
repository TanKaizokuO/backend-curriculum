# One image. It carries the code, the dependencies, and the migrations.
# It carries no secret and no data.

FROM python:3.12-slim

# Do not write .pyc files, and do not buffer the log. An unbuffered log
# reaches the platform immediately, so a crash loop is readable.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy the dependency list alone, so Docker reuses the install layer while
# only the code changes.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run as a normal user. A container that runs as root gives an attacker root
# inside the container.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser /app
USER appuser

# A platform tells you which port to listen on, through $PORT. Default to
# 8000 when nothing sets it.
EXPOSE 8000

# Warning: `--forwarded-allow-ips '*'` trusts the X-Forwarded-* headers on
# every request. Use it only when a proxy you control sits in front of the
# container and strips those headers from the client. On a platform that
# terminates TLS for you, that is true.
#
# `--proxy-headers` is already on by default in uvicorn 0.52.1. The switch
# that decides anything is `--forwarded-allow-ips`, which defaults to
# 127.0.0.1 and therefore trusts no proxy in another container.
#
# Two more rules fight here, and `exec` settles the fight.
#   1. Bind 0.0.0.0. Inside a container, 127.0.0.1 reaches the container
#      only, so a published port finds nothing.
#   2. $PORT must expand, and the exec form of CMD does not expand a
#      variable. So call `sh -c`, then `exec` uvicorn over the shell.
#      uvicorn becomes PID 1 and receives SIGTERM, so a redeploy shuts the
#      process down instead of killing it after a timeout.
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --forwarded-allow-ips '*'"]
