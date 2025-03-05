const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Define the IntellectualPropertySchema
const IntellectualPropertySchema = new Schema({
    index: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    owner: {
        name: { type: String, required: true },
        email: { type: String, required: true },
        physicalAddress: { type: String, required: true }
    },
    ipType: { type: String, required: true },
    dateOfCreation: { type: String, required: true },
    dateOfRegistration: { type: String, required: true },
    license: [{ type: String }],
    licenseIncentive: [{type:Number}],
    tags: [{ type: String }],
    optionalFields: {
        workType: { type: String },
        classOfGoods: { type: String },
        inventors: [{ type: String }],
        domainName: { type: String },
        publicationDate: { type: String }
    },
    ownerAddress: { type: String, required: true },
});

// Create a model based on the schema
const IntellectualProperty = mongoose.model("IntellectualPropertyTable", IntellectualPropertySchema);

// Export the model
module.exports = IntellectualProperty;
