const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://learner:lesson4@localhost:55432/bookmarks';
const pool = new Pool({ connectionString: DATABASE_URL });

// Simple Data Mapper / ORM pattern over the existing SQL schema (no auto-sync/create_all)
class BookmarkDataMapper {
  static async findById(id) {
    const { rows } = await pool.query('SELECT * FROM bookmarks WHERE id = $1', [id]);
    if (rows.length === 0) return null;
    const b = rows[0];
    return {
      id: parseInt(b.id, 10),
      url: b.url,
      title: b.title,
      visitCount: parseInt(b.visit_count, 10),
      // Lazy load simulation: tags are not fetched until requested
      async getTags() {
        const { rows: tags } = await pool.query(
          'SELECT t.name FROM tags t JOIN bookmark_tags bt ON bt.tag_id = t.id WHERE bt.bookmark_id = $1 ORDER BY t.name',
          [b.id]
        );
        return tags.map(r => r.name);
      }
    };
  }

  // Eager loading simulation: single query with join/array_agg
  static async findByIdWithTags(id) {
    const query = `
      SELECT b.id, b.url, b.title, b.visit_count,
             coalesce(array_agg(t.name ORDER BY t.name) FILTER (WHERE t.name IS NOT NULL), '{}') AS tags
      FROM bookmarks b
      LEFT JOIN bookmark_tags bt ON bt.bookmark_id = b.id
      LEFT JOIN tags t ON t.id = bt.tag_id
      WHERE b.id = $1
      GROUP BY b.id
    `;
    const { rows } = await pool.query(query, [id]);
    if (rows.length === 0) return null;
    const b = rows[0];
    return {
      id: parseInt(b.id, 10),
      url: b.url,
      title: b.title,
      visitCount: parseInt(b.visit_count, 10),
      tags: b.tags
    };
  }

  // Naive ORM save method
  static async save(bookmark) {
    await pool.query(
      'UPDATE bookmarks SET visit_count = $1, title = $2 WHERE id = $3',
      [bookmark.visitCount, bookmark.title, bookmark.id]
    );
  }

  // Atomic ORM increment method
  static async incrementVisitCount(id) {
    const { rows } = await pool.query(
      'UPDATE bookmarks SET visit_count = visit_count + 1 WHERE id = $1 RETURNING visit_count',
      [id]
    );
    return parseInt(rows[0].visit_count, 10);
  }
}

async function demonstrateORMDefect() {
  console.log('--- ORM Abstraction & Lost Update Demonstration ---');
  
  // Reset count
  await pool.query('UPDATE bookmarks SET visit_count = 0 WHERE id = 1');

  // Demonstrate Lazy Loading vs Eager Loading
  console.log('\n1. Lazy loading query pattern:');
  const b1 = await BookmarkDataMapper.findById(1);
  console.log(`Loaded bookmark: ${b1.title}`);
  const tags1 = await b1.getTags(); // Secondary query issued here
  console.log(`Tags (lazy fetched): ${tags1.join(', ')}`);

  console.log('\n2. Eager loading query pattern (single query join):');
  const b2 = await BookmarkDataMapper.findByIdWithTags(1);
  console.log(`Loaded bookmark with tags: ${b2.title}, tags: ${b2.tags.join(', ')}`);

  // Demonstrate ORM Naive Increment vs Atomic Increment
  console.log('\n3. ORM Naive Mutation: bookmark.visitCount += 1');
  const b = await BookmarkDataMapper.findById(1);
  b.visitCount += 1; // In-memory JS mutation
  await BookmarkDataMapper.save(b);
  console.log(`Saved visitCount via object mutation: ${b.visitCount}`);

  console.log('\n4. ORM Atomic Increment: BookmarkDataMapper.incrementVisitCount(1)');
  const newCount = await BookmarkDataMapper.incrementVisitCount(1);
  console.log(`Updated visitCount via atomic SQL statement: ${newCount}`);

  await pool.end();
}

if (require.main === module) {
  demonstrateORMDefect().catch(console.error);
}

module.exports = BookmarkDataMapper;
