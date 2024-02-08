const express = require("express");
const bodyParser = require("body-parser");
const Sequelize = require("sequelize");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");

const app = express();
const port = 3001;
const secretKey = "rahasia";

// Menggunakan bodyParser untuk meng-handle data dari request
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
	cors({
		origin: "*",
	})
);

// Konfigurasi Sequelize
const sequelize = new Sequelize("db_tnc", "root", "", {
	host: "localhost",
	dialect: "mysql",
});

// Model User
const User = sequelize.define("user", {
	email: {
		type: Sequelize.STRING,
		unique: true,
		allowNull: false,
	},
	username: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	password: {
		type: Sequelize.STRING,
		allowNull: false,
	},
});

// Model HasilPemeriksaan
const HasilPemeriksaan = sequelize.define("hasil_pemeriksaans", {
	nama_balita: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	umur_balita: {
		type: Sequelize.INTEGER,
		allowNull: false,
	},
	berat_badan: {
		type: Sequelize.INTEGER,
		allowNull: false,
	},
	tinggi_badan: {
		type: Sequelize.INTEGER,
		allowNull: false,
	},
	jenis_kelamin: {
		type: Sequelize.ENUM("laki-laki", "perempuan"),
		allowNull: false,
	},
	status_gizi: {
		type: Sequelize.STRING,
		allowNull: false,
	},
	tgl_pemeriksaan: {
		type: Sequelize.DATE,
		allowNull: false,
	},
	nama_orangtua: {
		type: Sequelize.STRING,
		allowNull: false,
	},
});

// Synchronize model dengan database
sequelize
	.sync()
	.then(() => {
		console.log("Database and tables created!");
	})
	.catch((err) => {
		console.error("Error syncing database:", err);
	});

// Route untuk registrasi user
app.post("/register", async (req, res) => {
	try {
		const { username, email, password } = req.body;

		// Hash password sebelum menyimpan ke database
		const hashedPassword = await bcrypt.hash(password, 10);

		// Simpan user baru ke database
		const user = await User.create({
			email,
			username,
			password: hashedPassword,
		});

		res.status(201).json({ message: "User registered successfully", user });
	} catch (error) {
		console.error("Error registering user:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// Route untuk login user
app.post("/login", async (req, res) => {
	try {
		const { email, password } = req.body;

		// Cari user berdasarkan email
		const user = await User.findOne({
			where: {
				email,
			},
		});

		// Jika user tidak ditemukan
		if (!user) {
			return res.status(404).json({ message: "User not found" });
		}

		// Bandingkan password yang dimasukkan dengan hashed password di database
		const isPasswordValid = await bcrypt.compare(password, user.password);

		// Jika password tidak valid
		if (!isPasswordValid) {
			return res.status(401).json({ message: "Invalid password" });
		}

		const token = jwt.sign({ userId: user.id, email: user.email }, secretKey, {
			expiresIn: "1h",
		});
		delete user.dataValues.password;

		res.status(200).json({ message: "Login successful", user, token });
	} catch (error) {
		console.error("Error logging in user:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// Route untuk menampilkan semua hasil pemeriksaan
app.get("/hasil_pemeriksaan", async (req, res) => {
	try {
		// Get query parameters for month, year, limit, and page (if provided)
		const { month, year, limit = 10, page = 1 } = req.query;

		// Set default values for month and year
		const currentMonth = month || new Date().getMonth() + 1; // Months are zero-based
		const currentYear = year || new Date().getFullYear();

		// Calculate offset based on pagination parameters
		const offset = (page - 1) * limit;

		// Query to get hasilPemeriksaan data based on month, year, and pagination
		const hasilPemeriksaan = await HasilPemeriksaan.findAndCountAll({
			where: {
				[Sequelize.Op.and]: [
					Sequelize.where(
						Sequelize.fn("MONTH", Sequelize.col("createdAt")),
						currentMonth
					),
					Sequelize.where(
						Sequelize.fn("YEAR", Sequelize.col("createdAt")),
						currentYear
					),
				],
			},
			limit: parseInt(limit, 10),
			offset: parseInt(offset, 10),
		});

		const totalData = hasilPemeriksaan.count;
		const totalPages = Math.ceil(totalData / limit);

		res.status(200).json({
			totalData,
			totalPages,
			currentPage: parseInt(page, 10),
			result: hasilPemeriksaan.rows,
		});
	} catch (error) {
		console.error("Error fetching hasil pemeriksaan:", error);
		return res.status(500).json({ message: "Internal Server Error" });
	}
});

// Route untuk menambah hasil pemeriksaan baru
app.post("/hasil_pemeriksaan", async (req, res) => {
	try {
		const hasilPemeriksaan = await HasilPemeriksaan.create(req.body);
		res.status(201).json({
			message: "Hasil pemeriksaan created successfully",
			hasilPemeriksaan,
		});
	} catch (error) {
		console.error("Error creating hasil pemeriksaan:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// Route untuk menampilkan hasil pemeriksaan berdasarkan ID
app.get("/hasil_pemeriksaan/:id", async (req, res) => {
	const { id } = req.params;
	try {
		const hasilPemeriksaan = await HasilPemeriksaan.findByPk(id);
		if (!hasilPemeriksaan) {
			return res.status(404).json({ message: "Hasil pemeriksaan not found" });
		}
		res.status(200).json(hasilPemeriksaan);
	} catch (error) {
		console.error("Error fetching hasil pemeriksaan:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// Route untuk menghapus hasil pemeriksaan berdasarkan ID
app.delete("/hasil_pemeriksaan/:id", async (req, res) => {
	const { id } = req.params;
	try {
		const deletedRows = await HasilPemeriksaan.destroy({
			where: { id },
		});
		if (deletedRows === 0) {
			return res.status(404).json({ message: "Hasil pemeriksaan not found" });
		}
		res.status(200).json({ message: "Hasil pemeriksaan deleted successfully" });
	} catch (error) {
		console.error("Error deleting hasil pemeriksaan:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

// Endpoint to get data for chart based on count of status_gizi
app.get("/chartData", async (req, res) => {
	try {
		// Define the possible status_gizi categories
		const possibleStatusArray = [
			"Gizi Buruk",
			"Gizi Kurang",
			"Gizi Baik",
			"Beresiko Gizi Lebih",
			"Gizi Lebih",
			"Obesitas",
		];

		const currentMonth = new Date().getMonth() + 1;
		const currentYear = new Date().getFullYear();
		const result = [];

		// Query to get count of each status_gizi, including 0 counts
		for (let i = 0; i < possibleStatusArray.length; i++) {
			const resultCount = await HasilPemeriksaan.count({
				where: {
					status_gizi: possibleStatusArray[i],
					createdAt: {
						[Sequelize.Op.and]: [
							Sequelize.where(
								Sequelize.fn("MONTH", Sequelize.col("createdAt")),
								currentMonth
							),
							Sequelize.where(
								Sequelize.fn("YEAR", Sequelize.col("createdAt")),
								currentYear
							),
						],
					},
				},
			});
			result.push(resultCount);
		}

		res.status(200).json(result);
	} catch (error) {
		console.error("Error fetching chart data:", error);
		res.status(500).json({ message: "Internal Server Error" });
	}
});

app.listen(port, () => {
	console.log(`Server running at http://localhost:${port}`);
});
