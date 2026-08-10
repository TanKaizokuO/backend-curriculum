from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

# ── Data ─────────────────────────────────────────────────

BOOKMARKS: dict[int, dict] = {}
next_id: int = 1

class BookmarkCreate(BaseModel):
    url: str
    title: str | None = None

# ── Endpoints ────────────────────────────────────────────

@app.get("/bookmarks")
async def list_bookmarks(skip: int = 0, limit: int = 10):
    """Return all bookmarks, paginated."""
    all_bookmarks = list(BOOKMARKS.values())
    return all_bookmarks[skip : skip + limit]

@app.api_route(
    "/bookmarks/{id}",
    methods=["GET", "DELETE"]
)
async def bookmark(request, bookmark_id: int):
    if request.method == "GET":
        """Return a single bookmark by ID."""
        if bookmark_id not in BOOKMARKS:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        return BOOKMARKS[bookmark_id]
    elif request.method == "DELETE":
        """Delete a bookmark by ID."""
        if bookmark_id not in BOOKMARKS:
            raise HTTPException(status_code=404, detail="Bookmark not found")
        del BOOKMARKS[bookmark_id]


@app.post("/bookmarks", status_code=201)
async def create_bookmark(bookmark: BookmarkCreate):
    """Create a new bookmark. Returns the created resource."""
    global next_id
    entry = {"id": next_id, "url": bookmark.url, "title": bookmark.title}
    BOOKMARKS[next_id] = entry
    next_id += 1
    return entry

   