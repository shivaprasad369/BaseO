import express from "express";

import pool from "./db.js";
import dotenv from "dotenv";

dotenv.config();
const checkout = express.Router();
// POST endpoint to insert data into tbl_finalmaster
checkout.post("/", async (req, res) => {
    const { UserID, OrderNumber, BillingFirstname, BillingLastname, BillingAddress, 
      BillingAddressLine2, BillingEmailID, BillingPhone, BillingCity, BillingPostalcode, 
      BillingCountry, ShippingFirstname, ShippingLastname, ShippingAddress, ShippingAddressLine2, 
      ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry, 
      GrandItemTotal, ShippingPrice, GrandTotal } = req.body;
  
    try {
    
      // First, check if the record already exists
      const checkQuery = `
        SELECT * FROM tbl_finalmaster 
        WHERE UserID = ? AND OrderNumber = ?  
      `;
      const [existingRecord] = await pool.execute(checkQuery, [UserID, OrderNumber]);
  
      if (existingRecord.length > 0) {
        // If the record exists, perform an update
        const updateQuery = `
          UPDATE tbl_finalmaster SET 
            BillingFirstname = ?, 
            BillingLastname = ?, 
            BillingAddress = ?, 
            BillingAddressLine2 = ?, 
            BillingEmailID = ?, 
            BillingPhone = ?, 
            BillingCity = ?, 
            BillingPostalcode = ?, 
            BillingCountry = ?, 
            ShippingFirstname = ?, 
            ShippingLastname = ?, 
            ShippingAddress = ?, 
            ShippingAddressLine2 = ?, 
            ShippingEmailID = ?, 
            ShippingPhone = ?, 
            ShippingCity = ?, 
            ShippingPostalcode = ?, 
            ShippingCountry = ?, 
            GrandItemTotal = ?, 
            ShippingPrice = ?, 
            GrandTotal = ? 
          WHERE UserID = ? AND OrderNumber = ?
        `;
        
        const updateValues = [
          BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, BillingEmailID, BillingPhone, 
          BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, ShippingLastname, 
          ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, ShippingCity, 
          ShippingPostalcode, ShippingCountry, GrandItemTotal, ShippingPrice, GrandTotal, 
          UserID, OrderNumber
        ];
  
        await pool.execute(updateQuery, updateValues);
        res.status(200).json({
          message: "Order updated successfully",
        });
      } else {
        // If the record doesn't exist, perform an insert
        const insertQuery = `
          INSERT INTO tbl_finalmaster (
            UserID, OrderNumber, BillingFirstname, BillingLastname, BillingAddress, 
            BillingAddressLine2, BillingEmailID, BillingPhone, BillingCity, BillingPostalcode, 
            BillingCountry, ShippingFirstname, ShippingLastname, ShippingAddress, ShippingAddressLine2, 
            ShippingEmailID, ShippingPhone, ShippingCity, ShippingPostalcode, ShippingCountry, 
            GrandItemTotal, ShippingPrice, GrandTotal
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)
        `;
  
        const insertValues = [
          UserID, OrderNumber, BillingFirstname, BillingLastname, BillingAddress, BillingAddressLine2, 
          BillingEmailID, BillingPhone, BillingCity, BillingPostalcode, BillingCountry, ShippingFirstname, 
          ShippingLastname, ShippingAddress, ShippingAddressLine2, ShippingEmailID, ShippingPhone, 
          ShippingCity, ShippingPostalcode, ShippingCountry, GrandItemTotal, ShippingPrice, GrandTotal
        ];
  
        const [result] = await pool.execute(insertQuery, insertValues);
        console.log("Record inserted with ID:", result.insertId);
  
        res.status(201).json({
          message: "Data inserted successfully",
          insertedId: result.insertId,
        });
      }
    } catch (err) {
      console.error("Error processing request:", err);
      res.status(500).json({ error: "Failed to process the request" });
    }
  });
  
checkout.get("/", async (req, res) => {
    const {orderId,user} = req.query; // Get the order ID from the URL parameters
  // console.log(req.query)
    const query = `
      SELECT 
        *
      FROM tbl_finalmaster
      WHERE OrderNumber = ?
    `;
  
    try {
      // Execute the query to fetch order data based on OrderNumber
      const [rows] = await pool.execute(query, [orderId]);
  
      // If no rows are found, send a 404 response
      if (rows.length === 0) {
        return res.status(404).json({ message: "Order not found" });
      }
  
      // Send the fetched data as a JSON response
      res.status(200).json({
        message: "Order fetched successfully",
        data: rows[0], // Return the first (and only) result
      });
    } catch (err) {
      console.error("Error fetching data: ", err);
      res.status(500).json({ error: "Failed to fetch data from the database" });
    }
  });
  checkout.put('/', async (req, res) => {
    const { orderId, cartNumber, user, stripeId, date } = req.body;
  
    // Check for missing parameters
    if (!orderId || !user) {
      return res.status(400).json({ error: 'Missing orderId or user parameter' });
    }
  
    try {
      // Step 1: Fetch items from tbl_tempcart
      const row = 'SELECT * FROM `tbl_tempcart` WHERE CartNumber=? AND UserID=?';
      const [cartItems] = await pool.execute(row, [cartNumber, user]);
  
      // Step 2: Insert data into tbl_finalcart if there are items in the cart
      if (cartItems.length > 0) {
        // Format data for bulk insert
        const finalCartData = cartItems.map(item => [
          user, 
          orderId, 
          item.ProductID,
          item.Price, 
          item.Qty, 
          item.ItemTotal, 
          date, 
           null, 
         null, 
          item.ItemTotalVoucherprice || null, 
          item.WebsiteType, 
          item.Voucherprice, 
          item.ProductAttributeID 
        ]
      );
  console.log(finalCartData)
        // Insert into tbl_finalcart (multiple rows)
        const query = `
        INSERT INTO \`tbl_finalcart\`(\`UserID\`, \`OrderNumber\`, \`ProductID\`, \`Price\`, \`Qty\`, \`ItemTotal\`, \`OrderDate\`, \`VedorProdStatus\`, \`SubOrderNo\`, \`ItemTotalVoucherprice\`, \`WebsiteType\`, \`Voucherprice\`, \`ProductAttributeId\`) 
        VALUES ?
      `;
      
      // Ensure you pass the array of arrays as the second parameter to execute
      const [insert] = await pool.query(query, [finalCartData]);
  
        if (insert.affectedRows > 0) {
          // Step 3: Delete from tbl_tempcart after successful insertion
          await pool.execute('DELETE FROM `tbl_tempcart` WHERE CartNumber=? AND UserID=?', [cartNumber, user]);
        } else {
          return res.status(500).json({ error: 'Failed to insert into tbl_finalcart' });
        }
      }
  
      // Step 4: Update tbl_finalmaster
      const userQuery = `
        UPDATE tbl_finalmaster SET stripeid = ?, OrderDate = ? WHERE OrderNumber = ? AND UserID = ?
      `;
      const [result] = await pool.execute(userQuery, [stripeId, date, orderId, user]);
  
      // Check if the update was successful
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      // Respond with success message
      res.status(201).json({
        message: 'Data inserted successfully',
        insertedId: result.insertId,
      });
    } catch (err) {
      // Catch any error and return a generic error message
      console.error(err);
      res.status(500).json({ error: 'Failed to process the request' });
    }
  });
  
  
  
export default checkout;
