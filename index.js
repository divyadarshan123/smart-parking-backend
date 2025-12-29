import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { validate as uuidValidate } from "uuid";

dotenv.config();

const app = express();

/* ✅ CORS — THIS IS ENOUGH */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  })
);

app.use(express.json());

/* ================= ROOT ================= */
app.get("/", (req, res) => {
  res.send("Smart Parking Backend Running");
});

/* ================= DB TEST ================= */
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query(
      "select current_user, current_database()"
    );
    res.json({ success: true, result: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= LOGIN ================= */
app.post("/login", async (req, res) => {
  const { phone } = req.body;

  try {
    const result = await pool.query(
      "SELECT id, name, role FROM users WHERE phone = $1",
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= USER BOOKINGS ================= */
app.get("/bookings/recent/:user_id", async (req, res) => {
  const { user_id } = req.params;

  if (!uuidValidate(user_id)) {
    return res.status(400).json({ success: false, error: "Invalid UUID" });
  }

  try {
    const result = await pool.query(
      `
      SELECT *
      FROM bookings
      WHERE user_id = $1
      ORDER BY start_time DESC
      LIMIT 3
      `,
      [user_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= MANAGER STATS ================= */
app.get("/manager/stats/:manager_id", async (req, res) => {
  const { manager_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        COUNT(b.id) AS total_bookings,
        COALESCE(SUM(p.amount), 0) AS total_revenue
      FROM bookings b
      JOIN payments p ON p.booking_id = b.id
      JOIN parking_locations l ON l.id = b.location_id
      WHERE l.manager_id = $1
      `,
      [manager_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= DRIVER CURRENT ================= */
app.get("/driver/current/:driver_id", async (req, res) => {
  const { driver_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT 
        b.id,
        v.vehicle_number,
        u.name AS customer_name,
        l.name AS location_name,
        b.status,
        b.slot
      FROM bookings b
      JOIN vehicles v ON v.user_id = b.user_id
      JOIN users u ON u.id = b.user_id
      JOIN parking_locations l ON l.id = b.location_id
      WHERE b.driver_id = $1
      AND b.status IN ('active', 'parked', 'retrieving')
      LIMIT 1
      `,
      [driver_id]
    );

    res.json({ success: true, data: result.rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ================= DRIVER ACTIONS ================= */
app.post("/driver/start-parking/:booking_id", async (req, res) => {
  const { booking_id } = req.params;

  await pool.query(
    `
    UPDATE bookings
    SET status = 'parked', start_time = NOW()
    WHERE id = $1
    `,
    [booking_id]
  );

  res.json({ success: true });
});

app.post("/driver/retrieve/:booking_id", async (req, res) => {
  const { booking_id } = req.params;

  await pool.query(
    `
    UPDATE bookings
    SET status = 'completed', end_time = NOW()
    WHERE id = $1
    `,
    [booking_id]
  );

  res.json({ success: true });
});

/* ================= START SERVER ================= */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port", PORT);
});
