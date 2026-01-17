// module.exports = connectDB;
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // We explicitly log this to see if it's working
    console.log("Attempting to connect with URI:", process.env.MONGO_URI);
    
    const connect = await mongoose.connect(process.env.MONGO_URI, {
      family: 4, // Force IPv4 to fix ENOTFOUND errors
    });

    // Add .yellow at the end of the string
    console.log(`MongoDB Connected: ${connect.connection.host}`);
   
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;