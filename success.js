import express from 'express'
import nodemailer from 'nodemailer';
import pool from './db.js';
import dotenv from "dotenv";

dotenv.config();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})
const order = express.Router();
order.post('/api/place-order', async (req, res) => {
  try {
    const { orderDetails, userEmail, userName } = req.body;

    // Create email content
    const mailOptions = {
      from:process.env.EMAIL_USER,
      to: userEmail,
      subject: 'Order Confirmation',
      text: `
        Hello ${userName},
        
        Thank you for your order! Here are the details of your order:
        
        Order ID: ${orderDetails.orderId}
        Product(s): ${orderDetails?.products?.map(product => product)}
        Total: £${orderDetails.totalPrice}
        
        Your order will be processed soon, and we'll notify you once it's shipped.
        
        Best regards,
        Baseo
      `,
    };

    // Send email
    await transporter.sendMail(mailOptions);
    // console.log("Confirmation email sent to:", userEmail);

    // Send success response
    res.status(200).json({ message: 'Order placed successfully and confirmation sent!' });
  } catch (error) {
    // console.error('Error sending  email:', error);
    res.status(500).json({ message: 'Failed to place order and send confirmation email' });
  }
});
 order.get('/',async(req,res)=>{
    const {orderId}=req.query;
    if(!orderId){
        return res.status(400).json({message:'Please provide orderId'});
    }
    try{
        const [rows] = await pool.query(`
            SELECT f.*, u.*, p.ProductName,p.Image FROM tbl_finalcart f 
            JOIN tbl_user u on u.UserID=f.UserID
            JOIN tbl_products p on p.ProductID = f.ProductID
            WHERE f.OrderNumber = ?`,
            [orderId]);
        res.status(200).json(rows);
    }catch(err){
        console.error('Error fetching orders:',err);
        res.status(500).json({message:'Failed to fetch orders'});
    }
 })
export default order