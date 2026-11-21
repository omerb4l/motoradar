import { pool } from '../config/db';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  bio: string | null;
  avatarUrl: string | null;
  ghostModeActive: boolean;
  isVerified: boolean;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  createdAt: string;
}

export interface Motorcycle {
  id: string;
  userId: string;
  brand: string;
  model: string;
  modelYear: number | null;
  displacementCc: number | null;
  vin: string | null;
  isVerified: boolean;
  photoUrl: string | null;
  photoIsVerified: boolean;
  odometerMi: number;
  odometerKm: number;
  ownershipStartDate: string | null;
  ownershipEndDate: string | null;
  topSpeed: number | null;
  topSpeedUnit: 'mph' | 'km/h';
  topSpeedContext: string | null;
  maxLeanDeg: number | null;
  maxLeanSide: 'LEFT' | 'RIGHT' | null;
  maxLeanContext: string | null;
  isPrimary: boolean;
  createdAt: string;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const { rows } = await pool.query(
    `SELECT id, username, email, bio, avatar_url AS "avatarUrl",
            ghost_mode_active AS "ghostModeActive", is_verified AS "isVerified",
            emergency_contact_name AS "emergencyContactName",
            emergency_contact_phone AS "emergencyContactPhone",
            created_at AS "createdAt"
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  return rows[0] ?? null;
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<{
    bio: string;
    avatarUrl: string;
    ghostModeActive: boolean;
    emergencyContactName: string;
    emergencyContactPhone: string;
  }>
): Promise<UserProfile | null> {
  const { rows } = await pool.query(
    `UPDATE users
     SET bio = COALESCE($2, bio),
         avatar_url = COALESCE($3, avatar_url),
         ghost_mode_active = COALESCE($4, ghost_mode_active),
         emergency_contact_name = COALESCE($5, emergency_contact_name),
         emergency_contact_phone = COALESCE($6, emergency_contact_phone),
         updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING id, username, email, bio, avatar_url AS "avatarUrl",
               ghost_mode_active AS "ghostModeActive", is_verified AS "isVerified",
               emergency_contact_name AS "emergencyContactName",
               emergency_contact_phone AS "emergencyContactPhone",
               created_at AS "createdAt"`,
    [
      userId,
      updates.bio ?? null,
      updates.avatarUrl ?? null,
      updates.ghostModeActive ?? null,
      updates.emergencyContactName ?? null,
      updates.emergencyContactPhone ?? null,
    ]
  );
  return rows[0] ?? null;
}

export async function getUserMotorcycles(userId: string): Promise<Motorcycle[]> {
  const { rows } = await pool.query(
    `SELECT id, user_id AS "userId", brand, model, model_year AS "modelYear",
            displacement_cc AS "displacementCc", vin, is_verified AS "isVerified",
            photo_url AS "photoUrl", photo_is_verified AS "photoIsVerified",
            odometer_mi AS "odometerMi", odometer_km AS "odometerKm",
            ownership_start_date AS "ownershipStartDate",
            ownership_end_date AS "ownershipEndDate",
            top_speed AS "topSpeed",
            top_speed_unit AS "topSpeedUnit", top_speed_context AS "topSpeedContext",
            max_lean_deg AS "maxLeanDeg", max_lean_side AS "maxLeanSide",
            max_lean_context AS "maxLeanContext", is_primary AS "isPrimary",
            created_at AS "createdAt"
     FROM motorcycles
     WHERE user_id = $1
     ORDER BY is_primary DESC, created_at DESC`,
    [userId]
  );
  return rows;
}

export async function addOrUpdateMotorcycle(
  userId: string,
  data: {
    id?: string;
    brand: string;
    model: string;
    modelYear?: number;
    displacementCc?: number;
    photoUrl?: string;
    photoIsVerified?: boolean;
    odometerKm?: number;
    odometerMi?: number;
    ownershipStartDate?: string;
    ownershipEndDate?: string;
    topSpeed?: number;
    topSpeedUnit?: 'mph' | 'km/h';
    topSpeedContext?: string;
    maxLeanDeg?: number;
    maxLeanSide?: 'LEFT' | 'RIGHT';
    maxLeanContext?: string;
    isPrimary?: boolean;
  }
): Promise<Motorcycle> {
  const nowStr = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });

  if (data.id) {
    if (data.isPrimary) {
      await pool.query(
        `UPDATE motorcycles 
         SET is_primary = FALSE, 
             ownership_end_date = CASE WHEN ownership_end_date IS NULL OR ownership_end_date = 'PRESENT' THEN $2 ELSE ownership_end_date END
         WHERE user_id = $1 AND id != $3`,
        [userId, nowStr, data.id]
      );
    }

    const { rows } = await pool.query(
      `UPDATE motorcycles
       SET brand = $2,
           model = $3,
           model_year = COALESCE($4, model_year),
           displacement_cc = COALESCE($5, displacement_cc),
           photo_url = COALESCE($6, photo_url),
           photo_is_verified = COALESCE($7, photo_is_verified),
           odometer_km = COALESCE($8, odometer_km),
           odometer_mi = COALESCE($9, odometer_mi),
           ownership_start_date = COALESCE($10, ownership_start_date),
           ownership_end_date = COALESCE($11, ownership_end_date),
           top_speed = COALESCE($12, top_speed),
           top_speed_unit = COALESCE($13, top_speed_unit),
           top_speed_context = COALESCE($14, top_speed_context),
           max_lean_deg = COALESCE($15, max_lean_deg),
           max_lean_side = COALESCE($16, max_lean_side),
           max_lean_context = COALESCE($17, max_lean_context),
           is_primary = COALESCE($18, is_primary),
           updated_at = now()
       WHERE id = $1 AND user_id = $19
       RETURNING id, user_id AS "userId", brand, model, model_year AS "modelYear",
                 displacement_cc AS "displacementCc", vin, is_verified AS "isVerified",
                 photo_url AS "photoUrl", photo_is_verified AS "photoIsVerified",
                 odometer_mi AS "odometerMi", odometer_km AS "odometerKm",
                 ownership_start_date AS "ownershipStartDate",
                 ownership_end_date AS "ownershipEndDate",
                 top_speed AS "topSpeed",
                 top_speed_unit AS "topSpeedUnit", top_speed_context AS "topSpeedContext",
                 max_lean_deg AS "maxLeanDeg", max_lean_side AS "maxLeanSide",
                 max_lean_context AS "maxLeanContext", is_primary AS "isPrimary",
                 created_at AS "createdAt"`,
      [
        data.id,
        data.brand,
        data.model,
        data.modelYear ?? 2024,
        data.displacementCc ?? 998,
        data.photoUrl ?? null,
        data.photoIsVerified ?? true,
        data.odometerKm ?? 0,
        data.odometerMi ?? 0,
        data.ownershipStartDate ?? nowStr,
        data.ownershipEndDate ?? (data.isPrimary ? 'PRESENT' : nowStr),
        data.topSpeed ?? 285,
        data.topSpeedUnit ?? 'km/h',
        data.topSpeedContext ?? 'TRACK DAY',
        data.maxLeanDeg ?? 52,
        data.maxLeanSide ?? 'LEFT',
        data.maxLeanContext ?? 'CANYON RUN',
        data.isPrimary ?? true,
        userId,
      ]
    );
    if (rows.length > 0) return rows[0];
  }

  // If set as primary, un-primary existing bikes for this user and set their end date
  if (data.isPrimary ?? true) {
    await pool.query(
      `UPDATE motorcycles 
       SET is_primary = FALSE, 
           ownership_end_date = CASE WHEN ownership_end_date IS NULL OR ownership_end_date = 'PRESENT' THEN $2 ELSE ownership_end_date END
       WHERE user_id = $1`,
      [userId, nowStr]
    );
  }

  const { rows } = await pool.query(
    `INSERT INTO motorcycles (
      user_id, brand, model, model_year, displacement_cc, photo_url, photo_is_verified,
      odometer_km, odometer_mi, ownership_start_date, ownership_end_date,
      top_speed, top_speed_unit, top_speed_context,
      max_lean_deg, max_lean_side, max_lean_context, is_primary
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
    RETURNING id, user_id AS "userId", brand, model, model_year AS "modelYear",
              displacement_cc AS "displacementCc", vin, is_verified AS "isVerified",
              photo_url AS "photoUrl", photo_is_verified AS "photoIsVerified",
              odometer_mi AS "odometerMi", odometer_km AS "odometerKm",
              ownership_start_date AS "ownershipStartDate",
              ownership_end_date AS "ownershipEndDate",
              top_speed AS "topSpeed",
              top_speed_unit AS "topSpeedUnit", top_speed_context AS "topSpeedContext",
              max_lean_deg AS "maxLeanDeg", max_lean_side AS "maxLeanSide",
              max_lean_context AS "maxLeanContext", is_primary AS "isPrimary",
              created_at AS "createdAt"`,
    [
      userId,
      data.brand,
      data.model,
      data.modelYear ?? 2024,
      data.displacementCc ?? 998,
      data.photoUrl ?? null,
      data.photoIsVerified ?? true,
      data.odometerKm ?? 0,
      data.odometerMi ?? 0,
      data.ownershipStartDate ?? nowStr,
      data.ownershipEndDate ?? 'PRESENT',
      data.topSpeed ?? 285,
      data.topSpeedUnit ?? 'km/h',
      data.topSpeedContext ?? 'TRACK RECORD',
      data.maxLeanDeg ?? 52,
      data.maxLeanSide ?? 'LEFT',
      data.maxLeanContext ?? 'CANYON RUN',
      data.isPrimary ?? true,
    ]
  );
  return rows[0];
}

export async function deleteMotorcycle(userId: string, motorcycleId: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `DELETE FROM motorcycles WHERE id = $1 AND user_id = $2`,
    [motorcycleId, userId]
  );
  return (rowCount ?? 0) > 0;
}

export async function setPrimaryMotorcycle(userId: string, motorcycleId: string): Promise<Motorcycle | null> {
  const nowStr = new Date().toLocaleString('en-US', { month: 'short', year: 'numeric' });
  await pool.query(
    `UPDATE motorcycles 
     SET is_primary = FALSE, 
         ownership_end_date = CASE WHEN ownership_end_date IS NULL OR ownership_end_date = 'PRESENT' THEN $2 ELSE ownership_end_date END
     WHERE user_id = $1`,
    [userId, nowStr]
  );

  const { rows } = await pool.query(
    `UPDATE motorcycles 
     SET is_primary = TRUE, ownership_end_date = 'PRESENT' 
     WHERE id = $1 AND user_id = $2
     RETURNING id, user_id AS "userId", brand, model, model_year AS "modelYear",
               displacement_cc AS "displacementCc", vin, is_verified AS "isVerified",
               photo_url AS "photoUrl", photo_is_verified AS "photoIsVerified",
               odometer_mi AS "odometerMi", odometer_km AS "odometerKm",
               ownership_start_date AS "ownershipStartDate",
               ownership_end_date AS "ownershipEndDate",
               top_speed AS "topSpeed",
               top_speed_unit AS "topSpeedUnit", top_speed_context AS "topSpeedContext",
               max_lean_deg AS "maxLeanDeg", max_lean_side AS "maxLeanSide",
               max_lean_context AS "maxLeanContext", is_primary AS "isPrimary",
               created_at AS "createdAt"`,
    [motorcycleId, userId]
  );
  return rows[0] ?? null;
}

export async function getPublicUserProfile(
  userId: string
): Promise<{ profile: Partial<UserProfile>; motorcycles: Motorcycle[] } | null> {
  const profile = await getUserProfile(userId);
  if (!profile) return null;
  const motorcycles = await getUserMotorcycles(userId);
  return {
    profile: {
      id: profile.id,
      username: profile.username,
      bio: profile.bio,
      avatarUrl: profile.avatarUrl,
      isVerified: profile.isVerified,
      createdAt: profile.createdAt,
    },
    motorcycles,
  };
}

