import express from "express";
import dotenv from "dotenv";
import pool from "./db.js";

dotenv.config();
const attribute = express.Router();

attribute.get('/product-attribute', async (req, res) => {
    const { productId } = req.query;
    const ProductId = parseInt(productId);

    if (!ProductId) {
        return res.status(400).json({ message: 'Please provide a product id' });
    }

    try {
        const result = await pool.query(`
            SELECT av.AttributeID, av.AttributeName, tbl_attributevalues.AttributeValueID, tbl_attributevalues.Value
            FROM tbl_attributes av
            JOIN tbl_attributevalues ON av.AttributeID = tbl_attributevalues.AttributeID
            WHERE av.CategoryID = ?
        `, [ProductId]);

        // Initialize an empty object to hold the parent-child structure
        const attributeMap = {};
            
        // Loop through the result to build the parent-child structure
        result[0].forEach(row => {
            const { AttributeID, AttributeName, AttributeValueID, Value } = row;

            // If this attribute doesn't exist in the map, create a new entry
            if (!attributeMap[AttributeID]) {
                attributeMap[AttributeID] = {
                    AttributeID,
                    AttributeName,
                    values: []
                };
            }

            // Push the child (attribute value) into the "values" array for this attribute
            attributeMap[AttributeID].values.push({
                AttributeValueID,
                Value
            });
        });

        // Convert the attributeMap object to an array for response
        const response = Object.values(attributeMap);

        // Send the formatted response
        res.json(response);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});


export default attribute;