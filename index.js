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
    .transaction(async (t) => {
      const promises = requestBody.map(async (jobData) => {
        try {
          // Check if a record with the same 'url' already exists
          const existingJob = await Job.findOne({
            where: { url: jobData.url },
            transaction: t,
          });

          if (existingJob) {
            // Update the existing record if it already exists
            await existingJob.update(jobData, { transaction: t });
            console.log(`Job with URL ${jobData.url[0]} updated.`);
          } else {
            // Create a new record if it doesn't exist
            await Job.create(jobData, { transaction: t });
            console.log(`Job with URL ${jobData.url[0]} created.`);
          }
        } catch (error) {
          console.error(`Error processing job with URL ${jobData.url}:`, error);
        }
      });

      // Execute all promises in parallel
      await Promise.all(promises);
    })
    .then(() => {
      console.log("Transaction committed");
    })
    .catch((error) => {
      console.error("Error:", error);
    });

  res.send("Hello, this is your Node.js API!");
});

// Start the server
app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});
