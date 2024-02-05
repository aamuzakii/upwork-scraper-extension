const express = require("express");
const app = express();
const port = 3000;
const bodyParser = require("body-parser");

const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize("postgres://developer:123@localhost:5432/olx"); // Example for postgres

const Job = sequelize.define(
  "Job",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    url: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      defaultValue: "",
    },
    stack: {
      type: DataTypes.STRING,
    },
    country: {
      type: DataTypes.STRING,
    },
    candidates: {
      type: DataTypes.STRING,
    },
    description: {
      type: DataTypes.STRING,
    },
    date: {
      type: DataTypes.STRING,
    },
    deleted: {
      type: DataTypes.BOOLEAN,
    },
  },
  {
    tableName: "Job",
    timestamps: false,
  }
);
// Middleware to log incoming requests
app.use((req, res, next) => {
  console.log(`${new Date().toLocaleString()} - ${req.method} ${req.url}`);
  next();
});

app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// Define a sample route
app.post("/store", async (req, res) => {
  const executor = (resolve, reject) => {
    let data = "";

    req.on("data", (chunk) => {
      data += chunk;
    });

    req.on("end", () => {
      resolve(data);
    });

    req.on("error", (error) => {
      reject(error);
    });
  };

  const body = await new Promise(executor);

  const requestBody = JSON.parse(body);
  console.log(requestBody);

  sequelize
    .sync()
    .then(() => {
      return Job.bulkCreate(requestBody);
    })
    .then((createdJobs) => {
      createdJobs.forEach((job) => {
        console.log(job.toJSON());
      });
    })
    .catch((error) => {
      console.error("Error creating jobs:", error);
    });

  res.send("Hello, this is your Node.js API!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
