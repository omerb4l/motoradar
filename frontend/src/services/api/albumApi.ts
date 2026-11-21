import { API_BASE_URL } from './config';

export interface AlbumPost {
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

export async function fetchAlbumPosts(token: string): Promise<AlbumPost[]> {
  const res = await fetch(`${API_BASE_URL}/album`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch album posts: ${res.status}`);
  }
  return res.json();
}

export async function createAlbumPost(
  token: string,
  data: {
    photoUrl: string;
    caption?: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    motorcycleId?: string;
  }
): Promise<AlbumPost> {
  const res = await fetch(`${API_BASE_URL}/album`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new Error(`Failed to create album post: ${res.status}`);
  }
  return res.json();
}

export async function removeAlbumPost(token: string, postId: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/album/${postId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to delete album post: ${res.status}`);
  }
}
