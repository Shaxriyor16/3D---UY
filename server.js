import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import path from "path";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// MongoDB ulash
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB ulandi"))
  .catch(err => console.log(err));

// Schema
const FoodSchema = new mongoose.Schema({
  name: String,
  category: String,
  description: String,
  price: Number,
  image: String,
  createdAt: { type: Date, default: Date.now }
});
const Food = mongoose.model("Food", FoodSchema);

// Static fayllar
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));
app.use(express.json());

// Multer (rasm yuklash)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// Taom qo‘shish (admin panel)
app.post("/api/add-food", upload.single("image"), async (req, res) => {
  const { name, category, description, price } = req.body;
  const newFood = new Food({
    name,
    category,
    description,
    price,
    image: req.file ? req.file.filename : null
  });
  await newFood.save();
  res.json({ message: "✅ Taom qo‘shildi!", food: newFood });
});

// Menyu ko‘rish (foydalanuvchi)
app.get("/api/menu", async (req, res) => {
  const foods = await Food.find().sort({ createdAt: -1 });
  res.json(foods);
});

app.listen(PORT, () => console.log(`🚀 Server ishlayapti: http://localhost:${PORT}`));

