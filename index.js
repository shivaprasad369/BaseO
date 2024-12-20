import express from "express";
import pool from "./db.js";
import cors from "cors";
import upload from "./uploads.js";
import path from "path";
import { fileURLToPath } from "url";
import stripePackage from 'stripe';   // Import Stripe
import router from "./Authenticate.js";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import checkout from "./Checkout..js";
import order from "./success.js";
import dashboard from "./dashboard.js";

dotenv.config(); 

const app = express();

app.use(cors());

app.use(express.json()); // Middleware to parse JSON bodies

app.use(express.urlencoded({ extended: true }));
// Equivalent to __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
let currentId = 202412085; // Starting value
const stripe = stripePackage(`sk_test_51P1t8WSBkoBjEhoPMrwvePnLJyEsHYOJQyJzmEO744LRzBeLwJN1tk1wrQtj5kwGmtYALYSMJIo1yPcUpTYVIdHm00wXx01AX2`);
app.use("/users", router);  
app.use("/checkout", checkout);  
app.use('/order',order)
app.use('/dashboard',dashboard)
app.post('/create-payment', async (req, res) => {
  try {
    const { amount, currency, description, customerName, customerAddress } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: currency,
      description: description,
      metadata: {
        export_description: 'This is an export transaction as per Indian regulations', 
      },
      receipt_email: req.body.email, 
      shipping: {
        name: customerName,
        address: customerAddress,
      },
    });

    res.send({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).send(error.message);
  }
}); 

// Serve uploaded images
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/users", router);
app.use("/checkout", checkout);

// Test the database connection
app.get("/test-db", async (req, res) => {
  console.log("connected");
  try {
    const [rows] = await pool.query("SELECT 1 + 1 AS result");
    res.send(`Database connected! Result: ${rows[0].result}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Database connection failed");
  }
});

// POST: Add a new subcategory
app.post("/categories", async (req, res) => {
  const {
    CategoryName,
    CatURL,
    Title,
    KeyWord,
    Description,
    Image,
    ParentCategoryID,
    SubCategoryLevel,
  } = req.body;

  try {
    if (!CategoryName || !SubCategoryLevel) {
      return res
        .status(400)
        .json({ message: "CategoryName and SubCategoryLevel are required" });
    }

    const query = `
            INSERT INTO tbl_category 
            (CategoryName, CatURL, Title, KeyWord, Description, Image, ParentCategoryID, SubCategoryLevel)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?);
        `;

    const [result] = await pool.query(query, [
      CategoryName,
      CatURL || null,
      Title || null,
      KeyWord || null,
      Description || null,
      Image || null,
      ParentCategoryID || null,
      SubCategoryLevel,
    ]);

    res.status(201).json({
      message: "Category added successfully",
      CategoryID: result.insertId,
    });
  } catch (err) {
    console.error("Error adding category:", err);
    res.status(500).json({ message: "Error adding category" });
  }
});

// GET request for fetching categories
app.get("/categories", async (req, res) => {
  try {
    const query = `
            SELECT 
                c1.CategoryID AS MainCategoryID,
                c1.CategoryName AS MainCategory,
                c1.Image AS MainCategoryImage,
                c1.Description AS MainCategoryDescription,
                c2.CategoryID AS SubCategoryOneID,
                c2.CategoryName AS SubCategoryOne,
                c3.CategoryID AS SubCategoryTwoID,
                c3.CategoryName AS SubCategoryTwo,
                c4.CategoryID AS SubCategoryThreeID,
                c4.CategoryName AS SubCategoryThree
            FROM tbl_category c1
            LEFT JOIN tbl_category c2 ON c2.ParentCategoryID = c1.CategoryID AND c2.SubCategoryLevel = 'One'
            LEFT JOIN tbl_category c3 ON c3.ParentCategoryID = c2.CategoryID AND c3.SubCategoryLevel = 'Two'
            LEFT JOIN tbl_category c4 ON c4.ParentCategoryID = c3.CategoryID AND c4.SubCategoryLevel = 'Three'
            WHERE c1.ParentCategoryID IS NULL
            ORDER BY c1.CategoryID, c2.CategoryID, c3.CategoryID, c4.CategoryID;
        `;

    const [results] = await pool.query(query);

    // Structure the data hierarchically
    const categories = [];
    const mainCategoriesMap = {};

    results.forEach((row) => {
      if (!mainCategoriesMap[row.MainCategoryID]) {
        mainCategoriesMap[row.MainCategoryID] = {
          CategoryID: row.MainCategoryID,
          CategoryName: row.MainCategory,
          Image: row.MainCategoryImage,
          Description: row.MainCategoryDescription,
          SubCategories: [],
        };
        categories.push(mainCategoriesMap[row.MainCategoryID]);
      }

      if (row.SubCategoryOneID) {
        let subCategoryOne = mainCategoriesMap[
          row.MainCategoryID
        ].SubCategories.find((sub) => sub.CategoryID === row.SubCategoryOneID);

        if (!subCategoryOne) {
          subCategoryOne = {
            CategoryID: row.SubCategoryOneID,
            CategoryName: row.SubCategoryOne,
            SubCategories: [],
          };
          mainCategoriesMap[row.MainCategoryID].SubCategories.push(
            subCategoryOne
          );
        }

        if (row.SubCategoryTwoID) {
          let subCategoryTwo = subCategoryOne.SubCategories.find(
            (sub) => sub.CategoryID === row.SubCategoryTwoID
          );

          if (!subCategoryTwo) {
            subCategoryTwo = {
              CategoryID: row.SubCategoryTwoID,
              CategoryName: row.SubCategoryTwo,
              SubCategories: [],
            };
            subCategoryOne.SubCategories.push(subCategoryTwo);
          }

          if (row.SubCategoryThreeID) {
            subCategoryTwo.SubCategories.push({
              CategoryID: row.SubCategoryThreeID,
              CategoryName: row.SubCategoryThree,
            });
          }
        }
      }
    });

    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});
app.get("/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
            SELECT 
                c1.CategoryID AS MainCategoryID,
                c1.CategoryName AS MainCategory,
                c1.Image AS MainCategoryImage,
                c1.Description AS MainCategoryDescription,
                c2.CategoryID AS SubCategoryOneID,
                c2.CategoryName AS SubCategoryOne,
                c3.CategoryID AS SubCategoryTwoID,
                c3.CategoryName AS SubCategoryTwo,
                c4.CategoryID AS SubCategoryThreeID,
                c4.CategoryName AS SubCategoryThree
            FROM tbl_category c1
            LEFT JOIN tbl_category c2 ON c2.ParentCategoryID = c1.CategoryID AND c2.SubCategoryLevel = 'One'
            LEFT JOIN tbl_category c3 ON c3.ParentCategoryID = c2.CategoryID AND c3.SubCategoryLevel = 'Two'
            LEFT JOIN tbl_category c4 ON c4.ParentCategoryID = c3.CategoryID AND c4.SubCategoryLevel = 'Three'
            WHERE c1.CategoryID = ?
            ORDER BY c1.CategoryID, c2.CategoryID, c3.CategoryID, c4.CategoryID;
        `;

    const [results] = await pool.query(query, [id]);

    // Structure the data hierarchically
    const categories = [];
    const mainCategoriesMap = {};

    results.forEach((row) => {
      if (!mainCategoriesMap[row.MainCategoryID]) {
        mainCategoriesMap[row.MainCategoryID] = {
          CategoryID: row.MainCategoryID,
          CategoryName: row.MainCategory,
          Image: row.MainCategoryImage,
          Description: row.MainCategoryDescription,
          SubCategories: [],
        };
        categories.push(mainCategoriesMap[row.MainCategoryID]);
      }

      if (row.SubCategoryOneID) {
        let subCategoryOne = mainCategoriesMap[
          row.MainCategoryID
        ].SubCategories.find((sub) => sub.CategoryID === row.SubCategoryOneID);

        if (!subCategoryOne) {
          subCategoryOne = {
            CategoryID: row.SubCategoryOneID,
            CategoryName: row.SubCategoryOne,
            SubCategories: [],
          };
          mainCategoriesMap[row.MainCategoryID].SubCategories.push(
            subCategoryOne
          );
        }

        if (row.SubCategoryTwoID) {
          let subCategoryTwo = subCategoryOne.SubCategories.find(
            (sub) => sub.CategoryID === row.SubCategoryTwoID
          );

          if (!subCategoryTwo) {
            subCategoryTwo = {
              CategoryID: row.SubCategoryTwoID,
              CategoryName: row.SubCategoryTwo,
              SubCategories: [],
            };
            subCategoryOne.SubCategories.push(subCategoryTwo);
          }

          if (row.SubCategoryThreeID) {
            subCategoryTwo.SubCategories.push({
              CategoryID: row.SubCategoryThreeID,
              CategoryName: row.SubCategoryThree,
            });
          }
        }
      }
    });

    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});
app.get("/categories/:id/:sub", async (req, res) => {
  try {
    const { id, sub } = req.params;
    const query = `
            SELECT 
                c1.CategoryID AS MainCategoryID,
                c1.CategoryName AS MainCategory,
                c1.Image AS MainCategoryImage,
                c1.Description AS MainCategoryDescription,
                c2.CategoryID AS SubCategoryOneID,
                c2.CategoryName AS SubCategoryOne,
                c3.CategoryID AS SubCategoryTwoID,
                c3.CategoryName AS SubCategoryTwo,
                c4.CategoryID AS SubCategoryThreeID,
                c4.CategoryName AS SubCategoryThree
            FROM tbl_category c1
            LEFT JOIN tbl_category c2 ON c2.ParentCategoryID = c1.CategoryID AND c2.SubCategoryLevel = 'One'
            LEFT JOIN tbl_category c3 ON c3.ParentCategoryID = c2.CategoryID AND c3.SubCategoryLevel = 'Two'
            LEFT JOIN tbl_category c4 ON c4.ParentCategoryID = c3.CategoryID AND c4.SubCategoryLevel = 'Three'
            WHERE  c1.ParentCategoryID = ? 
            ORDER BY c1.CategoryID, c2.CategoryID, c3.CategoryID, c4.CategoryID;
        `;

    const [results] = await pool.query(query, [sub]);

    // Structure the data hierarchically
    const categories = [];
    const mainCategoriesMap = {};

    results.forEach((row) => {
      if (!mainCategoriesMap[row.MainCategoryID]) {
        mainCategoriesMap[row.MainCategoryID] = {
          CategoryID: row.MainCategoryID,
          CategoryName: row.MainCategory,
          Image: row.MainCategoryImage,
          Description: row.MainCategoryDescription,
          SubCategories: [],
        };
        categories.push(mainCategoriesMap[row.MainCategoryID]);
      }

      if (row.SubCategoryOneID) {
        let subCategoryOne = mainCategoriesMap[
          row.MainCategoryID
        ].SubCategories.find((sub) => sub.CategoryID === row.SubCategoryOneID);

        if (!subCategoryOne) {
          subCategoryOne = {
            CategoryID: row.SubCategoryOneID,

            CategoryName: row.SubCategoryOne,
            SubCategories: [],
          };
          mainCategoriesMap[row.MainCategoryID].SubCategories.push(
            subCategoryOne
          );
        }

        if (row.SubCategoryTwoID) {
          let subCategoryTwo = subCategoryOne.SubCategories.find(
            (sub) => sub.CategoryID === row.SubCategoryTwoID
          );

          if (!subCategoryTwo) {
            subCategoryTwo = {
              CategoryID: row.SubCategoryTwoID,
              CategoryName: row.SubCategoryTwo,
              SubCategories: [],
            };
            subCategoryOne.SubCategories.push(subCategoryTwo);
          }

          if (row.SubCategoryThreeID) {
            subCategoryTwo.SubCategories.push({
              CategoryID: row.SubCategoryThreeID,
              CategoryName: row.SubCategoryThree,
            });
          }
        }
      }
    });

    res.status(200).json(categories);
  } catch (err) {
    console.error("Error fetching categories:", err);
    res.status(500).json({ message: "Error fetching categories" });
  }
});

app.post("/add-category", (req, res) => {
  const {
    CategoryName,
    CatURL,
    Title,
    KeyWord,
    Description,
    Image,
    ParentCategoryID,
    CategoryLevel,
  } = req.body;

  // Validate input
  if (!CategoryName || !CategoryLevel) {
    return res
      .status(400)
      .json({ message: "CategoryName and CategoryLevel are required" });
  }

  // Construct query dynamically
  const query = `
        INSERT INTO tbl_category (CategoryName, CatURL, Title, KeyWord, Description, Image, ParentCategoryID)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

  // Associate with parent if it's a subcategory
  let parentID = null;
  if (
    CategoryLevel === "SubCategoryOne" ||
    CategoryLevel === "SubCategoryTwo"
  ) {
    parentID = ParentCategoryID; // Subcategories need a parent ID
    if (!ParentCategoryID) {
      return res
        .status(400)
        .json({ message: "ParentCategoryID is required for subcategories" });
    }
  }

  // Execute query
  const res1 = pool.query(
    query,
    [CategoryName, CatURL, Title, KeyWord, Description, Image, parentID],
    (err, result) => {
      if (err) {
        console.error("Error inserting data:", err);
        return res.status(500).json({ message: "Error inserting category" });
      }
      res.status(200).json({
        message: `${CategoryLevel} added successfully`,
        CategoryID: result.insertId,
      });
    }
  );
  if (res1) {
    res.status(200).json({
      message: `${CategoryLevel} added successfully`,
      CategoryID: parentID,
    });
  }
});

// Fetch all users
app.get("/users", async (req, res) => {
  try {
    const [users] = await pool.query("SELECT * FROM users");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error fetching users");
  }
});

// Insert a new user
app.post("/users", async (req, res) => {
  const { name, email } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [name, email]
    );
    res.send(`User added with ID: ${result.insertId}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error adding user");
  }
});

// Update a user's email
app.put("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE users SET email = ? WHERE id = ?",
      [email, id]
    );
    if (result.affectedRows === 0)
      return res.status(404).send("User not found");
    res.send("User updated successfully");
  } catch (error) {
    console.error(error);
    res.status(500).send("Error updating user");
  }
});

// Delete a user
// Route to insert attributes
app.post("/attributes", async (req, res) => {
  const { AttributeName, CategoryID } = req.body;

  // Validate input
  if (!AttributeName || !CategoryID) {
    return res
      .status(400)
      .json({ error: "AttributeName and CategoryID are required." });
  }

  try {
    // Insert query
    const [result] = await pool.query(
      "INSERT INTO tbl_Attributes (AttributeName, CategoryID) VALUES (?, ?)",
      [AttributeName, CategoryID]
    );

    res.status(201).json({
      message: "Attribute inserted successfully",
      AttributeID: result.insertId,
      AttributeName,
      CategoryID,
    });
  } catch (error) {
    console.error("Error inserting attribute:", error);
    res
      .status(500)
      .json({ error: "An error occurred while inserting the attribute." });
  }
});
app.get("/attributes", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tbl_Attributes");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching attributes:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching attributes." });
  }
});

app.post("/attribute-values", async (req, res) => {
  const { AttributeID, Value } = req.body;

  // Validate input
  if (!AttributeID || !Value) {
    return res
      .status(400)
      .json({ error: "AttributeID and Value are required." });
  }

  try {
    // Insert query
    const [result] = await pool.query(
      "INSERT INTO tbl_AttributeValues (AttributeID, Value) VALUES (?, ?)",
      [AttributeID, Value]
    );

    res.status(201).json({
      message: "Attribute value inserted successfully",
      AttributeValueID: result.insertId,
      AttributeID,
      Value,
    });
  } catch (error) {
    console.error("Error inserting attribute value:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while inserting the attribute value.",
      });
  }
});
// Route to fetch attribute values
app.get("/attribute-values", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tbl_AttributeValues");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching attribute values:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching attribute values." });
  }
});
app.post("/products", upload.single("Image"), async (req, res) => {
  const {
    ProductName,
    CategoryID,
    Description,
    ProductPrice,
    Discount,
    Voucherprice,
    CashPrice,
    StockQuantity,
    SubCategoryIDtwo,
    SubCategoryIDone,
    BrandID,
    DiscountPercentage,
    DiscountPrice,
    SellingPrice,
    Modelname,
    ProductUrl,
    MetaTitle,
    MetaKeyWords,
    MetaDescription,
  } = req.body;

  // Check if file is uploaded and assign image path
  const image = req.file ? "uploads/" + req.file.filename : null;

  // Ensure required fields are present
  if (!ProductName || !ProductPrice || !image) {
    return res
      .status(400)
      .json({ error: "Product Name, Product Price, and Image are required." });
  }

  try {
    const query = `
        INSERT INTO tbl_products (
          ProductName, CategoryID, Description, ProductPrice, Discount,
          Voucherprice, CashPrice, StockQuantity, SubCategoryIDtwo, 
          SubCategoryIDone, Image, BrandID, DiscountPercentage, 
          DiscountPrice, SellingPrice, Modelname, ProductUrl, MetaTitle, 
          MetaKeyWords, MetaDescription
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

    const [result] = await pool.query(query, [
      ProductName,
      CategoryID,
      Description,
      ProductPrice,
      Discount,
      Voucherprice || null,
      CashPrice || null,
      StockQuantity || null,
      SubCategoryIDtwo || null,
      SubCategoryIDone || null,
      image,
      BrandID || null,
      DiscountPercentage || null,
      DiscountPrice || null,
      SellingPrice || null,
      Modelname || null,
      ProductName || null,
      MetaTitle || null,
      MetaKeyWords || null,
      MetaDescription || null,
    ]);

    res.status(201).json({
      message: "Product added successfully",
      ProductID: result.insertId,
      imageUrl: `http://localhost:3000/${image}`, // Return the image URL
    });
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ error: "Failed to add product." });
  }
});

app.get("/products", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM tbl_products");
    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ error: "Failed to fetch products." });
  }
});
app.get("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM tbl_products WHERE ProductID = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ error: "Failed to fetch product." });
  }
});
app.put("/products/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const query = "UPDATE tbl_products SET ? WHERE ProductID = ?";
    const [result] = await pool.query(query, [updates, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.status(200).json({ message: "Product updated successfully." });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ error: "Failed to update product." });
  }
});
app.delete("/products/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM tbl_products WHERE ProductID = ?",
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Product not found." });
    }

    res.status(200).json({ message: "Product deleted successfully." });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ error: "Failed to delete product." });
  }
});
// Route to insert product attributes
app.post("/product-attributes", async (req, res) => {
  const { ProductID, AttributeValueID } = req.body;

  // Validate input
  if (!ProductID || !AttributeValueID) {
    return res
      .status(400)
      .json({ error: "ProductID and AttributeValueID are required." });
  }

  try {
    // Insert query
    const [result] = await pool.query(
      "INSERT INTO tbl_productattribute (ProductID, AttributeValueID) VALUES (?, ?)",
      [ProductID, AttributeValueID]
    );

    res.status(201).json({
      message: "Product attribute inserted successfully",
      ProductAttributeID: result.insertId,
      ProductID,
      AttributeValueID,
    });
  } catch (error) {
    console.error("Error inserting product attribute:", error);
    res
      .status(500)
      .json({
        error: "An error occurred while inserting the product attribute.",
      });
  }
});
app.get("/product-attributes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `
            SELECT 
                pa.ProductAttributeID,
                pa.ProductID,
                p.SellingPrice,
                pa.AttributeValueID,
                av.Value AS AttributeValue,
                p.ProductName,
                p.Image,
                p.SubCategoryIDtwo,
                p.SubCategoryIDone,
                a.CategoryID,
                a.AttributeName
            FROM tbl_productattribute pa
            JOIN tbl_AttributeValues av ON pa.AttributeValueID = av.AttributeValueID
            JOIN tbl_attributes a ON av.AttributeID = a.AttributeID
            JOIN tbl_products p ON pa.ProductID = p.ProductID
            WHERE a.CategoryID = ?  
            GROUP BY pa.AttributeValueID,pa.ProductID
            `,
      [id] // Pass `id` as a parameter to prevent SQL injection
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching product attributes:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching product attributes." });
  }
});
app.get("/product-attributes/:id/:sub", async (req, res) => {
  try {
    const { id, sub } = req.params;
    const [rows] = await pool.query(
      `
            SELECT 
                pa.ProductAttributeID,
                pa.ProductID,
                p.SellingPrice,
                pa.AttributeValueID,
                av.Value AS AttributeValue,
                p.ProductName,
                p.Image,
                p.SubCategoryIDtwo,
                p.SubCategoryIDone,
                a.CategoryID,
                a.AttributeName
            FROM tbl_productattribute pa
            JOIN tbl_AttributeValues av ON pa.AttributeValueID = av.AttributeValueID
            JOIN tbl_attributes a ON av.AttributeID = a.AttributeID
            JOIN tbl_products p ON pa.ProductID = p.ProductID
            WHERE a.CategoryID = ? AND p.SubCategoryIDone=?
            GROUP BY pa.AttributeValueID,pa.ProductID
            `,
      [id, sub] // Pass `id` as a parameter to prevent SQL injection
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching product attributes:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching product attributes." });
  }
});
app.get("/product-attributes/:id/:sub/:two", async (req, res) => {
  try {
    const { id, sub, two } = req.params;
    const [rows] = await pool.query(
      `
        SELECT 
    pa.ProductAttributeID,
    pa.ProductID,
    p.SellingPrice,
    pa.AttributeValueID,
    av.Value AS AttributeValue,
    p.ProductName,
    p.Image,
    p.SubCategoryIDtwo,
    p.SubCategoryIDone,
    a.CategoryID,
    a.AttributeName
FROM tbl_productattribute pa
JOIN tbl_AttributeValues av ON pa.AttributeValueID = av.AttributeValueID
JOIN tbl_attributes a ON av.AttributeID = a.AttributeID
JOIN tbl_products p ON pa.ProductID = p.ProductID
WHERE a.CategoryID = ? 
  AND p.SubCategoryIDone = ? 
  AND p.SubCategoryIDtwo = ?
GROUP BY pa.AttributeValueID,pa.ProductID

            `,
      [id, sub, two]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching product attributes:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching product attributes." });
  }
});
app.get("/product-attribute/:id", async (req, res) => {
  try {
    const { id } = req.params; // Extract the Product ID from the request

    const [rows] = await pool.query(
      `
            SELECT 
                pa.ProductAttributeID,
                pa.ProductID,
                pa.AttributeValueID,
                av.Value AS AttributeValue,
              
                p.*,
                a.CategoryID,
                a.AttributeName,
                a.AttributeID
            FROM tbl_productattribute pa
            JOIN tbl_AttributeValues av ON pa.AttributeValueID = av.AttributeValueID
            JOIN tbl_attributes a ON av.AttributeID = a.AttributeID
            JOIN tbl_products p ON pa.ProductID = p.ProductID
            WHERE p.ProductID = ?
            GROUP BY av.AttributeID
            `,
      [id] // Use parameterized query to prevent SQL injection
    );

    if (rows.length === 0) {
      // If no rows are found, respond with a 404
      return res
        .status(404)
        .json({ message: "No attributes found for the specified product." });
    }

    res.status(200).json(rows); // Send the retrieved rows as JSON
  } catch (error) {
    console.error("Error fetching product attributes:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching product attributes." });
  }
});

// Route to fetch product attributes
app.get("/product-attributes", async (req, res) => {
  try {
    const [rows] = await pool.query(`
          SELECT 
    pa.ProductAttributeID,
    pa.ProductID,
    p.SellingPrice,
    pa.AttributeValueID,
    av.Value AS AttributeValue,
    p.ProductName,
    a.CategoryID,
    a.AttributeName
FROM tbl_productattribute pa
JOIN tbl_AttributeValues av ON pa.AttributeValueID = av.AttributeValueID
JOIN tbl_attributes a ON av.AttributeID = a.AttributeID
JOIN tbl_products p ON pa.ProductID = p.ProductID;

        `);

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching product attributes:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching product attributes." });
  }
});
app.get("/category/:categoryID/attributes", async (req, res) => {
  const { categoryID } = req.params;

  try {
    const query = `
            SELECT 
                a.AttributeName,
                av.Value
            FROM 
                tbl_Attributes a
            JOIN 
                tbl_AttributeValues av ON a.AttributeID = av.AttributeID
            WHERE 
                a.CategoryID = ?;
        `;

    const [rows] = await pool.query(query, [categoryID]);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ message: "No attributes found for this category." });
    }

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching attributes:", error);
    res.status(500).json({ error: "Failed to fetch attributes." });
  }
});
app.post("/add-banner", upload.single("bannerImage"), (req, res) => {

  const { bannerTitle, bannerText, description, urlLink, websiteType } =
    req.body;

  if (!req.file) {
    console.log("No file uploaded.");
    return res.status(400).json({ message: "No file uploaded!" });
  }

  const bannerImage = `/uploads/${req.file.filename}`;
  console.log("Banner image path:", bannerImage);

  const query = `
        INSERT INTO tbl_banner (BannerImage, BannerTitle, BannerText, Description, UrlLink, WebsiteType)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
  const values = [
    bannerImage,
    bannerTitle,
    bannerText,
    description,
    urlLink,
    websiteType,
  ];

  // console.log("Executing query...");
  const res1 = pool.query(query, values, (err, result) => {
    console.log("Inside pool.query callback");
    if (err) {
      console.error("Error inserting banner:", err);
      return res.status(500).json({ error: "Failed to add banner" });
    }
    console.log("Query result:", result);
    res
      .status(200)
      .json({
        message: "Banner added successfully!",
        bannerId: result.insertId,
      });
  });
  if (res1) {
    res.status(200).json({ message: "Banner added successfully!" });
  }
});
// Fetch all banners or banners filtered by WebsiteType
app.get("/banners", async (req, res) => {
  try {
    const query = "SELECT * FROM tbl_banner";
    const [results] = await pool.query(query); // Use await for promise-based query
    // console.log("Fetched banners:", results);
    res.status(200).json(results);
  } catch (err) {
    console.error("Error fetching banners:", err);
    res.status(500).json({ error: "Failed to fetch banners" });
  }
});

app.get("/popular-products", async (req, res) => {
  try {
    const query = `
            SELECT ProductID, ProductName,SubCategoryIDone, ProductPrice,DiscountPercentage,DiscountPrice,Discount,Sellingprice, Views, Image
            FROM tbl_products
            ORDER BY Views DESC
            LIMIT 10
        `;
    const [results] = await pool.query(query);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching popular products:", error);
    res.status(500).json({ error: "Failed to fetch popular products" });
  }
});

app.get("/stock-products", async (req, res) => {
  try {
    const query = ` 
            SELECT ProductID, ProductName, ProductPrice,DiscountPercentage,DiscountPrice,Discount,Sellingprice, Views, Image
            FROM tbl_products
            WHERE StockQuantity>=100
            ORDER BY StockQuantity DESC
            LIMIT 10
        `;
    const [results] = await pool.query(query);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching popular products:", error);
    res.status(500).json({ error: "Failed to fetch popular products" });
  }
});

app.post("/increment-view/:productId", async (req, res) => {
  const { productId } = req.params;

  try {
    const query =
      "UPDATE tbl_products SET Views = Views + 1 WHERE ProductID = ?";
    await pool.query(query, [productId]);

    res.status(200).json({ message: "View count updated" });
  } catch (error) {
    console.error("Error updating view count:", error);
    res.status(500).json({ error: "Failed to update view count" });
  }
});
// Route to add a review
app.post("/reviews", async (req, res) => {
  const { CustomerName, ProductID, ReviewText, Rating } = req.body;

  if (!CustomerName || !ProductID || !ReviewText || !Rating) {
    return res.status(400).json({ error: "All fields are required." });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO CustomerReviews (CustomerName, ProductID, ReviewText, Rating) VALUES (?, ?, ?, ?)`,
      [CustomerName, ProductID, ReviewText, Rating]
    );

    res
      .status(201)
      .json({
        message: "Review added successfully!",
        reviewId: result.insertId,
      });
  } catch (error) {
    console.error("Error adding review:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});
// Route to fetch all reviews
app.get("/reviews", async (req, res) => {
  const { page = 1, limit = 10 } = req.query; // Default to page 1, 10 reviews per page
  const offset = (page - 1) * limit;

  try {
    const [rows] = await pool.query(
      `SELECT * FROM CustomerReviews ORDER BY CreatedAt DESC LIMIT ? OFFSET ?`,
      [parseInt(limit), parseInt(offset)]
    );

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching paginated reviews:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// API to Add a New Brand
app.post("/brands", upload.single("brandImage"), async (req, res) => {
  const { brand } = req.body;
  const brandImage = req.file ? `/uploads/${req.file.filename}` : null;

  const query = "INSERT INTO tbl_brand (Brand, BrandImage) VALUES (?, ?)";

  try {
    const [result] = await pool.query(query, [brand, brandImage]);
    res.status(201).json({
      message: "Brand added successfully",
      brandId: result.insertId,
    });
  } catch (err) {
    console.error("Error adding brand:", err);
    res.status(500).json({ message: "Error adding brand" });
  }
});

// API to Fetch All Brands
app.get("/brands", async (req, res) => {
  const query = "SELECT * FROM tbl_brand";

  try {
    // Ensure `pool` is promise-based
    const [results] = await pool.query(query);
    res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching brands:", error);
    res.status(500).json({ message: "Error fetching brands" });
  }
});

// Add a Top Selling Category
app.post("/topcategories", upload.single("Image"), async (req, res) => {
  const { Name, CategoryID } = req.body;
  const Image = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    if (!req.body.CategoryID) {
      return res.status(400).json({ error: "CategoryID is required." });
    }
    const query = `INSERT INTO TopSellingCategories (CategoryID,Name, Image) VALUES (?,?,?)`;
    const [result] = await pool.query(query, [CategoryID, Name, Image]);

    res
      .status(201)
      .json({
        message: "Category added successfully!",
        categoryId: result.insertId,
      });
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).json({ message: "Error adding category." });
  }
});
// Fetch Top Selling Categories
app.get("/topcategories", async (req, res) => {
  try {
    const query = `SELECT * FROM TopSellingCategories`;
    const [rows] = await pool.query(query);

    res.status(200).json(rows);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Error fetching categories." });
  }
});

app.get("/generate-id", (req, res) => {
  currentId += 1; // Increment the ID by 1
  const uniqueId = `B${currentId}`;
  res.json({ id: uniqueId });
});
app.get("/get-cart-by-number", async (req, res) => {
  const { cartNumber, user } = req.query;
  if (!cartNumber ) {
    return res.status(400).json({ error: "Invalid or missing CartNumber" });
  }
  if (user && isNaN(Number(user))) {
    return res.status(400).json({ error: "Invalid User ID" });
  }
  try {
    let query = `
      SELECT 
        p.SellingPrice,
        p.Image,
        tc.*,
        p.ProductName
      FROM tbl_products p
      JOIN tbl_tempcart tc ON p.ProductID = tc.ProductID
    `;

    let queryParams = [];

    if (user) {
      query += `WHERE tc.UserID = ?`;
      queryParams.push(user);
    } else {
      query += `WHERE tc.CartNumber = ? AND tc.UserID=?`;
      queryParams.push(cartNumber,1);
      // queryParams.push(1);
    }

    // query += ` GROUP BY tc.ProductAttributeID`;

    const [rows] = await pool.query(query, queryParams);

    if (rows.length === 0) {
      return res.status(404).json({ message: "No cart items found" });
    }

    return res.status(200).json({
      message: "Cart items retrieved successfully",
      data: rows,
    });
  } catch (error) {
    console.error("Error retrieving cart data:", error);
    return res.status(500).json({ error: "An unexpected error occurred" });
  }
});

app.get("/get-updated-cart", async (req, res) => {
  const { cartNumber, userId } = req.query;

  try {
    // Validate input
    if (!cartNumber || !userId) {
      return res.status(400).json({ error: "CartNumber and userId are required." });
    }

    // Fetch cart data for the given user
    const [rows] = await pool.query(
      `
        SELECT 
          p.SellingPrice,
          p.Image,
          tc.*,
          p.ProductName
        FROM tbl_products p
        JOIN tbl_tempcart tc ON p.ProductID = tc.ProductID
        WHERE tc.UserID = ?
        GROUP BY tc.ProductAttributeID
      `,
      [userId]
    );

    // Check if cart is empty
    if (rows.length === 0) {
      return res.status(404).json({ message: "No cart items found for the given user." });
    }

    // Prepare data for batch insertion into `tbl_finalcart`
    const insertData = rows.map((row) => [
      userId, // UserID
      row.ProductID, // ProductID
      row.Price, // Price
      row.Qty, // Qty
      row.Price * row.Qty, // ItemTotal
      0, // VedorProdStatus (default)
      `SUB${Date.now()}${row.ProductID}`, // SubOrderNo
      row.Price * row.Qty, // ItemTotalVoucherprice
      1, // WebsiteType (default)
      0 // Voucherprice (default)
    ]);

    // Batch insert cart items into `tbl_finalcart`
    const insertQuery = `
      INSERT INTO tbl_finalcart 
      (UserID, ProductID, Price, Qty, ItemTotal, OrderDate, VedorProdStatus, SubOrderNo, ItemTotalVoucherprice, WebsiteType, Voucherprice)
      VALUES ?
    `;

    await pool.query(insertQuery, [insertData]);

    // Return success response
    res.status(200).json({
      message: "Cart updated successfully.",
      insertedItems: insertData.length,
    });
  } catch (error) {
    console.error("Error updating cart data:", error);
    res.status(500).json({ error: "Failed to update cart data." });
  }
});

// Endpoint to store or update cart items
app.post("/store-cart", async (req, res) => {
    const { cartItems } = req.body;
    const {id}=req.query;
  
    if (!cartItems || !cartItems.CartNumber || !cartItems.ProductAttributeID) {
      return res.status(400).json({ error: "CartNumber and ProductAttributeID are required." });
    }
  
    try {
      // Check if the product already exists in the cart
      const [existingItem] = await pool.execute(
        `SELECT Qty FROM tbl_tempcart 
         WHERE CartNumber = ? AND ProductAttributeID = ? AND UserID=?`,
        [cartItems.CartNumber, cartItems.ProductAttributeID,id]
      );
  
      if (existingItem.length > 0) {
        // Product exists, update the quantity and item total
        const updatedQty = existingItem[0].Qty + cartItems.Qty;
        const itemTotal = updatedQty * cartItems.Price;
  
        await pool.execute(
          `UPDATE tbl_tempcart 
           SET Qty = ?, ItemTotal = ? 
           WHERE CartNumber = ? AND ProductAttributeID = ?`,
          [updatedQty, itemTotal, cartItems.CartNumber, cartItems.ProductAttributeID]
        );
  
        return res.status(200).json({ message: "Cart item quantity updated successfully" });
      } else {
        // Product doesn't exist, insert it
        const values = [
          cartItems.UserID || null,
          cartItems.CartNumber || null,
          cartItems.ProductID || null,
          cartItems.ProductAttributeID || null,
          cartItems.Price || 0,
          cartItems.Qty || 1,
          cartItems.Price * cartItems.Qty || 0,
          cartItems.TranxRef || `TRX-${Date.now()}`,
          cartItems.CartDate || new Date(),
          cartItems.Voucherprice || 0,
        ];
  
        const insertQuery = `INSERT INTO tbl_tempcart (UserID,CartNumber, ProductID, ProductAttributeID, Price, Qty, ItemTotal, TranxRef, CartDate, Voucherprice) 
                             VALUES (?,?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        await pool.execute(insertQuery, values);
  
        return res.status(200).json({ message: "Cart item stored successfully" });
      }
    } catch (error) {
      console.error("Error storing cart item:", error);
      return res.status(500).json({ error: "Failed to store cart item" });
    }
  });
  
// Endpoint to update quantity
app.put("/update-quantity", async (req, res) => {
    const { id, userId, number,user } = req.body;

    if (!id || !userId || !number || !number.qty || !number.action) {
      return res.status(400).json({
        error: "id, userId, number.qty, and number.action are required.",
      });
    }
  
    if (!["increment", "decrement"].includes(number.action)) {
      return res
        .status(400)
        .json({ error: 'Invalid action. Use "increment" or "decrement".' });
    }
  
    try {
      const operation = number.action === "increment" ? "+" : "-";
      const [updateResult] = await pool.execute(
        `UPDATE tbl_tempcart 
         SET Qty = GREATEST(0, Qty ${operation} ?), 
             ItemTotal = Price * GREATEST(0, Qty ${operation} ?) 
         WHERE ProductAttributeID = ? AND CartNumber = ? AND UserID=?`,
        [number.qty, number.qty, id, userId,user]
      );
  
      if (updateResult.affectedRows > 0) {
        // Check if the quantity is now 0 and delete the item
        const [checkResult] = await pool.execute(
          `SELECT Qty FROM tbl_tempcart 
           WHERE ProductAttributeID = ? AND CartNumber = ?`,
          [id, userId]
        );
  
        if (checkResult.length > 0 && checkResult[0].Qty === 0) {
          await pool.execute(
            `DELETE FROM tbl_tempcart 
             WHERE ProductAttributeID = ? AND CartNumber = ?`,
            [id, userId]
          );
          return res.status(200).json({ message: "Item deleted as quantity reached 0" });
        }
  
        return res.status(200).json({ message: "Quantity updated successfully" });
      } else {
        return res.status(404).json({ error: "Product not found in cart" });
      }
    } catch (error) {
      console.error("Error updating quantity:", error);
      return res.status(500).json({ error: "Failed to update quantity" });
    }
  });
  app.put('/update-cart-user',async(req,res)=>{
    const {cartNumber,userId}=req.body;
    if(!cartNumber || !userId){
      return res.status(401).json({message:"cart number and id must required"})
    }
    try{
      const [result]=await pool.execute(
        `UPDATE tbl_tempcart 
        SET UserID =?
        WHERE CartNumber = ? AND UserId=?`,
       [userId,cartNumber,1]
      );
      if(result.affectedRows>0){
        return res.status(200).json({message:"User updated successfully in cart"})
      }
    }
    catch{
      return res.status(500).json({message:"Error updating user in cart"})
    }
  })
  app.delete("/delete-cart-item", async (req, res) => {
    const { productAttributeID, cartNumber,user } = req.query; // Use req.query instead of req.params
  
    if (!productAttributeID || !cartNumber) {
      return res
        .status(400)
        .json({ error: "productAttributeID and cartNumber are required." });
    }
  
    try {
      const [result] = await pool.execute(
        `DELETE FROM tbl_tempcart 
         WHERE ProductAttributeID = ? AND CartNumber = ? AND UserID=?`,
        [productAttributeID, cartNumber,user]
      );
  
      if (result.affectedRows > 0) {
        return res.status(200).json({ message: "Cart item deleted successfully" });
      } else {
        return res.status(404).json({ error: "Cart item not found" });
      }
    } catch (error) {
      console.error("Error deleting cart item:", error);
      return res.status(500).json({ error: "Failed to delete cart item" });
    }
  });
  
// Start the server
app.listen(5000, () => {
  console.log("Server running on port 5000");
});