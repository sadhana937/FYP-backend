// models/IPAccess.js
const mongoose = require("mongoose");

const IPAccessSchema = new mongoose.Schema({
  userAddress: { type: String, required: true },
  ipId: { type: Number, required: true },
  txHash: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model("IPAccess", IPAccessSchema);
