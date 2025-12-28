import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db.js";
import { validate as uuidValidate } from "uuid";


dotenv.config();

const checkApiKey = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: "API key missing",
    });
  }

  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      error: "Invalid API key",
    });
  }

  next(); 
};

const isUUID = (id) => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
};

const app = express();
app.use(cors());
app.use(express.json());








app.get("/", (req, res) => {
  res.send("Smart Parking Backend Running");
});



// 🔍 DB test route
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("select current_user, current_database()");
    res.json({ success: true, result: result.rows });
  } catch (err) {
    console.error("FULL DB ERROR 👉", err);
    res.status(500).json({
      success: false,
      error: err.message || "NO ERROR MESSAGE",
      code: err.code,
    });
  }
});



app.get("/manager/active-cars/:location_id", checkApiKey, async (req, res) => {
  const { location_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT COUNT(*) AS active_cars
      FROM bookings
      WHERE location_id = $1
      AND status = 'parked'
      `,
      [location_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("ACTIVE CARS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/manager/retrieving/:location_id", async (req, res) => {
  const { location_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT COUNT(*) AS retrieving
      FROM bookings
      WHERE location_id = $1
      AND status = 'retrieving'
      `,
      [location_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("RETRIEVING ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/manager/today-bookings/:location_id", async (req, res) => {
  const { location_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT COUNT(*) AS total_today
      FROM bookings
      WHERE location_id = $1
      AND DATE(start_time) = CURRENT_DATE
      `,
      [location_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("TODAY BOOKINGS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/manager/revenue/:location_id", checkApiKey, async (req, res) => {
  const { location_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT COALESCE(SUM(p.amount), 0) AS revenue
      FROM payments p
      JOIN bookings b ON p.booking_id = b.id
      WHERE b.location_id = $1
      AND DATE(b.start_time) = CURRENT_DATE
      `,
      [location_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("REVENUE ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get("/locations", async (req, res) => {
  try {
    const result = await pool.query(
      "select * from parking_locations"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("LOCATIONS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/bookings/recent/:user_id", checkApiKey, async (req, res) => {
  const { user_id } = req.params;

    if (!uuidValidate(user_id)) {
    return res.status(400).json({
      success: false,
      error: "Invalid UUID format",
    });
  }

  try {
    const result = await pool.query(
      `
      select *
      from bookings
      where user_id = $1
      order by start_time desc
      limit 3
      `,
      [user_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("RECENT BOOKINGS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.get("/bookings/history/:user_id", checkApiKey, async (req, res) => {
  const { user_id } = req.params;

    if (!uuidValidate(user_id)) {
    return res.status(400).json({
      success: false,
      error: "Invalid UUID format",
    });
  }

  try {
    const result = await pool.query(
      `
      select *
      from bookings
      where user_id = $1
      order by start_time desc
      `,
      [user_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("BOOKING HISTORY ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/payments/:user_id", checkApiKey, async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      `
      select p.*
      from payments p
      join bookings b on b.id = p.booking_id
      where b.user_id = $1
      `,
      [user_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("PAYMENTS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/manager/locations/:manager_id", async (req, res) => {
  const { manager_id } = req.params;

  try {
    const result = await pool.query(
      `
      select *
      from parking_locations
      where manager_id = $1
      `,
      [manager_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("MANAGER LOCATIONS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/manager/stats/:manager_id", async (req, res) => {
  const { manager_id } = req.params;

  try {
    const result = await pool.query(
      `
      select
        count(b.id) as total_bookings,
        sum(p.amount) as total_revenue
      from bookings b
      join payments p on p.booking_id = b.id
      join parking_locations l on l.id = b.location_id
      where l.manager_id = $1
      `,
      [manager_id]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("MANAGER STATS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/driver/bookings/:driver_id", async (req, res) => {
  const { driver_id } = req.params;

  try {
    const result = await pool.query(
      `
      select *
      from bookings
      where driver_id = $1
      and status in ('active', 'ongoing')
      order by start_time desc
      `,
      [driver_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("DRIVER BOOKINGS ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { phone } = req.body;

  try {
    const result = await pool.query(
      `SELECT id, name, role FROM users WHERE phone = $1`,
      [phone]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (err) {
    console.error("LOGIN ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/bookings/with-vehicle/:user_id", async (req, res) => {
  const { user_id } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT
        b.id AS booking_id,
        b.start_time,
        b.status,
        l.name AS location_name,
        l.address,
        v.vehicle_number,
        v.type AS vehicle_type
      FROM bookings b
      JOIN parking_locations l ON l.id = b.location_id
      LEFT JOIN vehicles v ON v.user_id = b.user_id
      WHERE b.user_id = $1
      ORDER BY b.start_time DESC
      `,
      [user_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error("BOOKINGS + VEHICLE ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


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
    console.error("DRIVER CURRENT ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


app.post("/driver/start-parking/:booking_id", async (req, res) => {
  const { booking_id } = req.params;

  try {
    await pool.query(
      `
      UPDATE bookings
      SET status = 'parked', start_time = NOW()
      WHERE id = $1
      `,
      [booking_id]
    );

    res.json({ success: true, message: "Parking started" });
  } catch (err) {
    console.error("START PARKING ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/driver/retrieve/:booking_id", async (req, res) => {
  const { booking_id } = req.params;

  try {
    await pool.query(
      `
      UPDATE bookings
      SET status = 'completed', end_time = NOW()
      WHERE id = $1
      `,
      [booking_id]
    );

    res.json({ success: true, message: "Vehicle retrieved" });
  } catch (err) {
    console.error("RETRIEVE ERROR 👉", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 👨‍✈️ MANAGER → ASSIGN DRIVER
app.post("/manager/assign-driver", async (req, res) => {
  const { booking_id, driver_id } = req.body;

  // safety check
  if (!booking_id || !driver_id) {
    return res.status(400).json({
      success: false,
      error: "booking_id and driver_id required",
    });
  }

  try {
    await pool.query(
      `
      UPDATE bookings
      SET driver_id = $1,
          status = 'active'
      WHERE id = $2
      `,
      [driver_id, booking_id]
    );

    res.json({
      success: true,
      message: "Driver assigned successfully",
    });
  } catch (err) {
    console.error("ASSIGN DRIVER ERROR 👉", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});








const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
