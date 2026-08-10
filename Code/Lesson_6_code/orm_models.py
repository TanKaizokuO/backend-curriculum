"""SQLAlchemy 2.x models for the schema the migrations already built.

There is no Base.metadata.create_all() here, and that is deliberate. The
migrations own the schema. These classes only describe it, so that Python can
map rows onto objects. If the two ever disagree, the database wins.
"""

import datetime

from sqlalchemy import Column, ForeignKey, Table
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


# The junction table from Lesson 4. It carries no data of its own, so it stays
# a plain Table instead of a mapped class.
bookmark_tags = Table(
    "bookmark_tags",
    Base.metadata,
    Column("bookmark_id", ForeignKey("bookmarks.id", ondelete="CASCADE"),
           primary_key=True),
    Column("tag_id", ForeignKey("tags.id", ondelete="CASCADE"),
           primary_key=True),
)


class Bookmark(Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    url: Mapped[str]
    title: Mapped[str | None]
    created_at: Mapped[datetime.datetime]
    visit_count: Mapped[int]

    # This attribute is a query. Read that sentence again.
    tags: Mapped[list["Tag"]] = relationship(
        secondary=bookmark_tags, order_by="Tag.name"
    )

    def __repr__(self) -> str:
        return f"Bookmark(id={self.id!r}, title={self.title!r})"


class Tag(Base):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]

    def __repr__(self) -> str:
        return f"Tag(name={self.name!r})"
