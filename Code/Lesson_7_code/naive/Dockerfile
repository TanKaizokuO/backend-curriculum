# The container a beginner writes. Every line here is a defect.
# Lesson 7 makes each one fail in front of you, then names the fix.

FROM python:3.12-slim
WORKDIR /app
COPY . .
RUN pip install --no-cache-dir -r requirements.txt

# Defect 1: the secret is in the image. `docker history` prints it.
ENV DATABASE_URL=postgresql://learner:lesson4@localhost:55432/bookmarks

# Defect 2: no --host, so uvicorn binds 127.0.0.1 inside the container and
# the published port reaches nothing.
# Defect 3: --reload watches for source edits that never come, and it runs
# a second process for no reason.
CMD ["uvicorn", "main:app", "--reload", "--port", "8000"]
