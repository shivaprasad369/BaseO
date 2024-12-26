import express from "express";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import pool from "../db.js";
import dotenv from "dotenv";
dotenv.config();
const adminroute = express.Router();
adminroute.post("/register", async (req, res) => {
    const { FullName, UserName, Password, EmailID, PhoneNo } = req.body;
    if (!FullName || !UserName || !Password || !EmailID) {
        return res.status(400).json({ message: "All fields are required" });
    }
    try {
        const [existingUser] = await pool.execute(
            `SELECT * FROM tbl_admin WHERE UserName = ? OR EmailID = ?`,
            [UserName, EmailID]
        );
        if (existingUser.length > 0) {
            return res.status(409).json({
                message: "User with the same UserName or EmailID already exists",
            });
        }
        const salt = uuidv4();
        const hashedPassword = await bcrypt.hash(Password, 10);
        const [result] = await pool.execute(
            `INSERT INTO tbl_admin (FullName, UserName, PasswordHash, Salt, EmailID, PhoneNo) VALUES (?, ?, ?, ?, ?, ?)`,
            [FullName, UserName, hashedPassword, salt, EmailID, PhoneNo]
        );

        res.status(201).json({ message: "Admin registered successfully", AdminID: result.insertId });
    } catch (error) {
        res.status(500).json({ error: "Failed to register user" });
    }
});
adminroute.post("/login", async (req, res) => {
  const { UserName, Password } = req.body;
  if (!UserName || !Password) {
    return res.status(400).json({ error: "Email and password are required" });
  }
  try {
    const [rows] = await pool.execute(
      `SELECT * FROM tbl_admin WHERE UserName = ?`,
      [UserName]
    );
    if (rows.length === 0) {
      return res
        .status(401)
        .json({ error: "Invalid credentials or email not verified" });
    }
    const user = rows[0];
    const password =Password;
    const isPasswordMatch = await bcrypt.compare(
      password,
      user.PasswordHash
    );
    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    const token = jwt.sign(
      { AdminID: user.AdminID, UserName: user.UserName },
      process.env.JWT_SECRET,
      {
        expiresIn: "2h",
      }
    );
    res
      .status(200)
      .json({ token, message: "Login successful", email: user.EmailID });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});

adminroute.get("/verify", (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.status(200).json({ message: "Token is valid", user: decoded });
  } catch (error) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});
export default adminroute;
