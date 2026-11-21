import { pool } from '../config/db';

export interface AlbumPostRow {
  id: string;
  user_id: string;
  motorcycle_id?: string;
  photo_url: string;
  caption?: string;
  location_name?: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
}

export async function getAlbumPostsForUser(userId: string): Promise<AlbumPostRow[]> {
  const { rows } = await pool.query<AlbumPostRow>(
    `SELECT id, user_id, motorcycle_id, photo_url, caption, location_name,
            latitude::float, longitude::float, created_at
     FROM moto_album_posts
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function createAlbumPost(
  userId: string,
  data: {
    photoUrl: string;
    caption?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    motorcycleId?: string;
  }
): Promise<AlbumPostRow> {
  const { rows } = await pool.query<AlbumPostRow>(
    `INSERT INTO moto_album_posts (user_id, motorcycle_id, photo_url, caption, location_name, latitude, longitude)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, motorcycle_id, photo_url, caption, location_name,
               latitude::float, longitude::float, created_at`,
    [
      userId,
      data.motorcycleId || null,
      data.photoUrl,
      data.caption || null,
      data.locationName || null,
      data.latitude || null,
      data.longitude || null,
    ]
  );
  return rows[0];
}

export async function deleteAlbumPost(userId: string, postId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM moto_album_posts WHERE id = $1 AND user_id = $2`,
    [postId, userId]
  );
  return (rowCount ?? 0) > 0;
}
