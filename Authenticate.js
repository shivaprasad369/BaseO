import express from 'express'
import bcrypt from 'bcrypt'
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken'
import nodemailer from 'nodemailer';
import pool from './db.js';
import dotenv from "dotenv";



dotenv.config();
const router = express.Router();

// Email Transporter (Nodemailer)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Register User
router.post("/register", async (req, res) => {
  const { firstName,lastName, email, password } = req.body;
console.log(req.body)
  if (!firstName || !lastName || !email || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const salt = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);

    const [result] = await pool.execute(
      `INSERT INTO tbl_user (FirstName, LastName, EmailID, PasswordHash, Salt, Status) 
       VALUES (?, ?, ?, ?, ?, 0)`,
      [firstName, lastName, email, hashedPassword, salt]
    );

    const token = jwt.sign({ Email: email }, process.env.JWT_SECRET, { expiresIn: '1h' });

    const verificationUrl = `https://baseo.onrender.com/users/verify-email?token=${token}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to:email,
      subject: "Email Verification",
      html: `<p>Click <a href="${verificationUrl}">here</a> to verify your email.</p>`,
    });

    res.status(200).json({ message: "User registered. Check your email for verification." });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ error: "Failed to register user" });
  }
});


const verifyEmail = async (req, res) => {
  // Token can be either in the query string or authorization header
  const token = req.query.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(400).json({ error: 'Token is required.' });
  }

  try {
    // Decoding the JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if the decoded token contains the email
    const email = decoded.Email; 

    if (!email) {
      return res.status(400).json({ error: 'Invalid token. Email not found.' });
    }
    
    // Ensure the email parameter is not undefined
    const result = await pool.execute(
      'UPDATE tbl_user SET Status = 1 WHERE EmailID = ?',
      [email] // Use email directly here, no need for null
    );

    // Check if the update was successful
    if (result[0].affectedRows > 0) {
      res.status(200).json({ message: 'Email verified successfully.' });
    } else {
      res.status(404).json({ error: 'User not found.' });
    }
  } catch (error) {
    console.error('Error verifying email:', error);

    // Handle specific error types
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(400).json({ error: 'Invalid or expired token.' });
    }

    // General error handling
    res.status(500).json({ error: 'Error verifying email.' });
  }
};

router.get('/verify-email', verifyEmail);
router.get("/verify-token", (req, res) => {
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

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
console.log(req.body)
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT * FROM tbl_user WHERE EmailID = ? AND Status = 1`,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials or email not verified" });
    }

    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(password, user.PasswordHash);

    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.UserID, email: user.EmailID,FirstName:user.FirstName,LastName:user.LastName }, process.env.JWT_SECRET, {
      expiresIn: "2h",
    });

    res.status(200).json({ token, message: "Login successful",username:user.FirstName,email:user.EmailID });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ error: "Failed to log in" });
  }
});
router.put('/', async (req, res) => {
  const { userId, firstName, lastName, email } = req.body;
  if (!userId || !firstName || !lastName || !email) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try {
    const result = await pool.execute(
      'UPDATE tbl_user SET FirstName=?, LastName=?, EmailID=? WHERE UserID=?',
      [firstName, lastName, email, userId] 
    );
    if (result[0].affectedRows > 0) {
      return res.status(200).json({ message: 'User information updated successfully.' });
    } else {
      return res.status(404).json({ error: 'User not found.' });
    }
  } catch (error) {
    console.error(error); 
    return res.status(500).json({ error: "Failed to update user information" });
  }
});
router.get('/info',async(req,res)=>{
  const {userId } = req.query;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM tbl_user WHERE UserID=?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = rows[0];
    res.status(200).json({ message: 'User information',user});
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to retrieve user information" });
  }
})
router.put('/change',async(req,res)=>{
  const { userId, oldPassword, newPassword } = req.body;
  if (!userId || !oldPassword || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }
  try{
    const [rows] = await pool.execute(
      'SELECT * FROM tbl_user WHERE UserID=?',
      [userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const user = rows[0];
    const isPasswordMatch = await bcrypt.compare(oldPassword, user.PasswordHash);
    if (!isPasswordMatch) {
      return res.status(401).json({ error: "Invalid old password" });
    }
    const salt = uuidv4();
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const result = await pool.execute(
      'UPDATE tbl_user SET PasswordHash=?, Salt=? WHERE UserID=?',
      [hashedPassword, salt, userId]
    );
    if (result[0].affectedRows > 0) {
      return res.status(200).json({ message: 'Password changed successfully.' });
    } else {
      return res.status(404).json({ error: 'User not found.' });
    }
  }catch{
    return res.status(500).json({ error: "Failed to change password" });
  }
})
export default router;
