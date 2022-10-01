var express = require("express");
const path = require("path");
const AWS = require("aws-sdk");
const multer = require("multer");
const { v4: uuid } = require("uuid");

const CLOUD_FRONT_URL = "https://d21ffgxto8wq85.cloudfront.net/";

const storage = multer.memoryStorage({
  destination(req, file, callback) {
    callback(null, "");
  },
});

function checkFileType(file, cb) {
  const fileType = /jpeg|jpg|png|gif/;

  const extname = fileType.test(path.extname(file.originalname).toLowerCase());
  const mineType = fileType.test(file.mimetype);
  if (extname && mineType) {
    return cb(null, true);
  }

  return cb("Error: Image Only");
}

const s3 = new AWS.S3({
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const documentDb = new AWS.DynamoDB.DocumentClient();
var router = express.Router();

const tableName = "products";

const upload = multer({
  storage,
  limits: { fileSize: 2000000 },
  fileFilter(req, file, cb) {
    checkFileType(file, cb);
  },
});

/* GET home page. */
router.get("/", function (req, res, next) {
  const params = {
    TableName: tableName,
  };
  documentDb.scan(params, (err, data) => {
    if (err) {
      res.send("Internal Server Error");
    } else {
      console.log(data.Items[0]);
      return res.render("index", { products: data.Items });
    }
  });
});

// router.post("/", upload.fields([]), (req, res) => {
//   const params = {
//     TableName: tableName,
//     Item: {
//       ...req.body,
//     },
//   };
//   documentDb.put(params, (err, data) => {
//     if (err) {
//       res.send("Internal Server error");
//     } else {
//       return res.redirect("/");
//     }
//   });
// });

router.post("/", upload.single("image"), (req, res) => {
  const { product_id, name, amount } = req.body;

  const image = req.file.originalname.split(".");

  const fileType = image[image.length - 1];

  const filePath = `${uuid() + Date.now().toString()}.${fileType}`;

  const params = {
    Bucket: "hoangdh2001",
    Key: filePath,
    Body: req.file.buffer,
  };

  s3.upload(params, (error, data) => {
    if (error) {
      console.log(`error =`, error);
      return res.send("Internal Server Error S3");
    } else {
      const newItem = {
        TableName: tableName,
        Item: {
          product_id: product_id,
          name: name,
          amount: amount,
          image: `${CLOUD_FRONT_URL}${filePath}`,
        },
      };

      documentDb.put(newItem, (err, data) => {
        if (err) {
          console.log("error = ", err);
          return res.send("Internal Server Error Put");
        } else {
          return res.redirect("/");
        }
      });
    }
  });
});

router.get("/delete", (req, res) => {
  const params = {
    TableName: tableName,
    Key: {
      product_id: req.query.id,
    },
  };
  documentDb.delete(params, (err, data) => {
    if (err) {
      res.send("Internal Server error");
    } else {
      return res.redirect("/");
    }
  });
});

router.get("/update", (req, res) => {
  const params = {
    TableName: tableName,
    Key: {
      product_id: req.query.id,
    },
  };
  documentDb.get(params, (err, data) => {
    if (err) {
      res.send("Internal server error");
    } else {
      return res.render("update", { product: data.Item });
    }
  });
});

router.post("/update", async (req, res) => {
  console.log(req.body);
  const params = {
    TableName: tableName,
    Key: {
      product_id: req.query.product_id,
    },
    AttributeUpdates: {
      name: req.query.name,
      amount: req.query.amount,
    },
  };
  await documentDb.update(params, (err, data) => {
    if (err) {
      res.send("Internal server error");
      console.log(err);
    } else {
      return res.redirect("/");
    }
  });
});

module.exports = router;
