import ServicesModel from "../models/Services.model.js";
import { deleteFileFromAWS } from "../services/aws.service.js";

/** POST: http://localhost:3027/api/v1/createService
 * @body {
 *  "category": "SampleCategory",
 *  "subcategory": "[ {\"title\": \"Sub1\"}, {\"title\": \"Sub2\"}]",
 *  "subcategoryImages": ["file1", "file2"]
 * }
 */
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

/** GET: http://localhost:3027/api/v1/getAllServices */
export async function getAllServices(req, res) {
    try {
        const services = await ServicesModel.find();
        
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

/** PUT: http://localhost:3027/api/v1/addSubCategory
 * @body {
 *  "category": "SampleCategory",
 *  "subcategory": "[ {\"title\": \"Sub1\"}, {\"title\": \"Sub2\"}]", //send only new subcategory in it not all subcategory subcategory
 *  "subcategoryImages": ["file1", "file2"]
 * }
 */
export async function addSubCategory(req, res) {
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

        const service = await ServicesModel.findOne({ category: category });
        if (!service) {
            return res.status(404).json({ success: false, message: `No service for ${category} found.` });
        }

        // Extract uploaded files and associate them with subcategories
        const subcategoryImageUrls = req.files ? req.files.map(file => file.location) : [];
        
        if (subcategoryImageUrls.length < subcategories.length) {
            return res.status(400).json({
                success: false,
                message: "Ensure that an image is provided for each subcategory."
            });
        }

        // Map new subcategories with images
        const newSubcategories = subcategories.map((subcat, index) => ({
            title: subcat.title,
            image: subcategoryImageUrls[index] || null
        }));

        // Add new subcategories without filtering
        service.subcategory.push(...newSubcategories);

        // Save the updated service
        const updatedService = await service.save();

        // Return the updated service
        return res.status(200).json({
            success: true,
            message: `${filteredSubcategories.length} subcategories added successfully.`,
            data: updatedService
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

/** DELETE: http://localhost:3027/api/v1/removeSubCategory
 * @body {
    "category":"SampleCategory",
    "subcategoryTitle":"Sub2"
}
 */
export async function removeSubCategory(req, res) {
    try {
        const { category, subcategoryTitle } = req.body;

        // Validate input
        if (!category || !subcategoryTitle) {
            return res.status(400).json({
                success: false,
                message: "Both category and subcategoryTitle are required."
            });
        }

        // Find the service by category
        const service = await ServicesModel.findOne({ category });
        if (!service) {
            return res.status(404).json({
                success: false,
                message: `No service for category '${category}' found.`
            });
        }

        // Check if the subcategory exists
        const subcategoryIndex = service.subcategory.findIndex(
            (subcat) => subcat.title === subcategoryTitle
        );

        if (subcategoryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: `Subcategory '${subcategoryTitle}' not found in category '${category}'.`
            });
        }

        // Delete the associated image from AWS S3
        const imageToDelete = service.subcategory[subcategoryIndex].image;
        if (imageToDelete) {
            const deletionSuccess = await deleteFileFromAWS(imageToDelete);
            if (!deletionSuccess) {
                console.warn(`Failed to delete image: ${imageToDelete}`);
            }
        }

        // Remove the subcategory
        service.subcategory.splice(subcategoryIndex, 1);


        // Save the updated service
        const updatedService = await service.save();

        // Return the updated service
        return res.status(200).json({
            success: true,
            message: `Subcategory '${subcategoryTitle}' removed successfully.`,
            data: updatedService
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error: ' + error.message
        });
    }
}

/** DELETE: http://localhost:3027/api/v1/removeSubCategory
 * @body {
    "category":"SampleCategory"
}
 */
export async function deleteService(req, res) {
    try {
        const { category } = req.body;
        const service = await ServicesModel.findOne({ category });
        if (!service) {
            return res.status(404).json({
                success: false,
                message: `Service '${category}' not found.`
            });
        }

        // Delete subcategory images from AWS S3
        if (service.subcategory && service.subcategory.length > 0) {
            for (const subcat of service.subcategory) {
                if (subcat.image) {
                    
                    const subcatImageDeletionSuccess = await deleteFileFromAWS(subcat.image);
                    if (!subcatImageDeletionSuccess) {
                        console.warn(`Failed to delete subcategory image: ${subcat.image}`);
                    }
                }
            }
        }

        // Delete the service document from the database
        await ServicesModel.deleteOne({ category });

        // Return a success response
        return res.status(200).json({
            success: true,
            message: `Service '${category}' deleted successfully.`
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}