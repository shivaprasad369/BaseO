import express from "express";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();
const dashboard = express.Router();
dashboard.get('/',async(req,res)=>{
    const {user}=req.query;
    const userId = parseInt(user);
    if(!userId){
        return res.status(400).json({message:'Please login'});
    }
    try{
        const [rows] = await pool.query(`
            SELECT u.*, fm.*,fc.*, p.ProductName,p.Image FROM tbl_user u 
            JOIN tbl_finalmaster fm on fm.UserID = u.UserID
            JOIN tbl_finalcart fc on fc.OrderNumber = fm.OrderNumber
            JOIN tbl_products p on fc.ProductID=p.ProductID
            WHERE u.UserID = ? AND fm.UserID=? AND fc.UserID=?`,
            [userId,userId,userId]);
        res.json(rows);  
    }catch{
        return res.status(500).json({message:'Failed to fetch user data'});
    }
})
export default dashboard