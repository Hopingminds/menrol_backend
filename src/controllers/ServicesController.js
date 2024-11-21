import ServicesModel from "../models/Services.model.js";

export async function createService(req, res) {
    try {
        const { category, subcategory } = req.body;

        // Parse subcategory data only if it's a string
        const subcategories = typeof subcategory === 'string' ? JSON.parse(JSON.parse(subcategory)) : subcategory;

        // Validate inputs
        if (!category ||  !Array.isArray(subcategories) || subcategories.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Category and subcategory (as a non-empty array) are required."
            });
        }

        // Check if the category already exists
        const existingService = await ServicesModel.findOne({ category });

        if (existingService) {
            return res.status(400).json({
                success: false,
                message: "Category already exists. Please update the existing category if needed."
            });
        }

        // Extract image URLs from the uploaded files
        const subcategoryImageUrls = req.files ? req.files.map(file => file.location) : [];
        
        // Validate that images were uploaded
        if (subcategoryImageUrls.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Both category image and at least one subcategory image are required."
            });
        }
        console.log(subcategories);
        
        // Create a new service document
        const newService = new ServicesModel({
            category,
            subcategory: subcategories.map((subcategory, index) => ({
                title: subcategory.title,
                image: subcategoryImageUrls[index] || null // Save the subcategory image URLs
            }))
        });

        // Save to the database
        const savedService = await newService.save();

        // Respond with the created service
        return res.status(201).json({ 
            success: true, 
            message: "Service created successfully.", 
            data: savedService 
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error: ' + error.message
        });
    }
}

export async function getAllServices(req, res) {
    try {
        const services = await ServicesModel.find();
        console.log(services);
        
        if(services.length === 0){
            return res.status(200).json({ 
                success: false, 
                message: "No data found" 
            });
        }

        return res.status(200).json({ 
            success: true, 
            data: services 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}
