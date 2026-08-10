import os, psycopg

conn = psycopg.connect(os.environ["DATABASE_URL"])
user_input = "' OR '1'='1"

# NEVER do this
naive = f"SELECT id, title FROM bookmarks WHERE title = '{user_input}'"
print("naive SQL :", naive)
print("naive rows:", conn.execute(naive).fetchall())

# do this
safe = conn.execute("SELECT id, title FROM bookmarks WHERE title = %s",
                    (user_input,))
print("safe  rows:", safe.fetchall())
