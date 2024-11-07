const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const residentsRouter = require("./Routes/residents");
const rotationRoutes = require("./Routes/rotations");
const scheduleRoutes = require("./Routes/ScheduleRoutes");
const publishingSettingsRoutes = require('./Routes/publishingSettings');
const shiftRoutes = require("./Routes/shiftRoutes");

dotenv.config();

console.log('JWT_SECRET:', process.env.JWT_SECRET); 

const app = express();
app.use(express.json());
app.use(cors());

const DB_USERNAME = process.env.DB_USERNAME || "ahsansiddiqui";
const DB_PASSWORD = process.env.DB_PASSWORD || "Ahsan_Password_1903";
const DB_NAME = process.env.DB_NAME || "Medrez";

const dbURI = `mongodb+srv://${DB_USERNAME}:${DB_PASSWORD}@cluster0.osqy2nd.mongodb.net/${DB_NAME}`;

mongoose
  .connect(dbURI, {})
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },
});

const User = mongoose.model("User", userSchema);

app.post("/api/signup", async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || "user", 
    });
    
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET || "default_secret_key", {
      expiresIn: "1h",
    });

    res.status(201).json({ token, user: newUser }); 
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "default_secret_key", {
      expiresIn: "1h",
    });

    res.status(200).json({
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role, 
      },
    });
  } catch (error) {
    console.error("Server error during login:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.use("/api/residents", residentsRouter);
app.use("/api/rotations", rotationRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/publishing-settings", publishingSettingsRoutes);
app.use("/api/shifts", shiftRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Middleware for authentication and role checking
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Unauthorized, no token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret_key");
    req.user = decoded; 
    next(); 
  } catch (error) {
    return res.status(403).json({ message: "Token is invalid" });
  }
};

const roleMiddleware = (role) => {
  return (req, res, next) => {
    if (req.user && req.user.role === role) {
      next(); 
    } else {
      return res.status(403).json({ message: `Access denied for ${role}s` });
    }
  };
};

module.exports = { authMiddleware, roleMiddleware };
