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
        const subcategories = typeof subcategory === 'string' ? JSON.parse(subcategory) : subcategory;

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
                image: subcategoryImageUrls[index] || null, // Save the subcategory image URLs
                pricing: subcategory.pricing
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

/** GET: http://localhost:3027/api/v1/getServices */
export async function getServices(req, res) {
    try {
        const { providerTypes } = req.query;
        let services;

        // Prepare query to filter based on providerTypes
        const query = {};

        if (providerTypes) {
            // If providerTypes includes "hourly", filter subcategories where hourlyWorker > 0
            if (providerTypes.includes("hourly")) {
                query["subcategory.hourlyWorker"] = { $gt: 0 };
            }

            // If providerTypes includes "daily", filter subcategories where dailyWageWorker > 0
            if (providerTypes.includes("daily")) {
                query["subcategory.dailyWageWorker"] = { $gt: 0 };
            }

            // If providerTypes includes "contract", filter subcategories where contractWorker > 0
            if (providerTypes.includes("contract")) {
                query["subcategory.contractWorker"] = { $gt: 0 };
            }

            // Find services based on the constructed query, but only return matching subcategories
            services = await ServicesModel.aggregate([
                { $match: query },  // Match the conditions
                {
                    $project: {
                        category: 1,
                        subcategory: {
                            $filter: {
                                input: "$subcategory",  // The array of subcategories
                                as: "subcat",
                                cond: {
                                    $or: [
                                        { $gt: ["$$subcat.hourlyWorker", 0] },
                                        { $gt: ["$$subcat.dailyWageWorker", 0] },
                                        { $gt: ["$$subcat.contractWorker", 0] }
                                    ]
                                }
                            }
                        }
                    }
                }
            ]);
        } else {
            // Fetch all services in one go
            const all = await ServicesModel.find();

            // Filter subcategories in-memory to avoid multiple database queries
            const filterSubcategories = (service, condition) => {
                const filteredSubcategories = service.subcategory.filter(condition);
                return filteredSubcategories.length > 0
                    ? { ...service.toObject(), subcategory: filteredSubcategories }
                    : null;
            };

            // Filter for hourly, daily, and contract workers
            const hourly = all
                .map(service => filterSubcategories(service, subcat => subcat.hourlyWorker > 0))
                .filter(service => service);

            const daily = all
                .map(service => filterSubcategories(service, subcat => subcat.dailyWageWorker > 0))
                .filter(service => service);

            const contract = all
                .map(service => filterSubcategories(service, subcat => subcat.contractWorker > 0))
                .filter(service => service);

            return res.status(200).json({
                success: true,
                all,
                hourly,
                daily,
                contract,
            });
        }

        // Response when providerTypes is provided
        return res.status(200).json({
            success: true,
            data: services
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
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
        const subcategories = typeof subcategory === 'string' ? JSON.parse(subcategory) : subcategory;

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
            image: subcategoryImageUrls[index] || null,
            pricing: subcat.pricing,
        }));

        // Add new subcategories without filtering
        service.subcategory.push(...newSubcategories);

        // Save the updated service
        const updatedService = await service.save();

        // Return the updated service
        return res.status(200).json({
            success: true,
            message: `${newSubcategories.length} subcategories added successfully.`,
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

/** DELETE: http://localhost:3027/api/v1/deleteService
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

export async function addCategoryImage(req, res) {
    try {
        const { categoryId } = req.body;
        
        // Check if a file was uploaded
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        // Find the service category by ID
        const service = await ServicesModel.findById(categoryId);
        if (!service) {
            return res.status(404).json({ success: false, message: 'Service category not found' });
        }

        // If there's an existing image, delete it from AWS S3
        if (service.categoryImage) {
            await deleteFileFromAWS(service.categoryImage);
        }

        // Update the service category with the image path or URL
        service.categoryImage = req.file.location; // Assuming Multer stores the file path in req.file.path

        // Save the updated service category
        await service.save();

        return res.status(200).json({ 
            success: true, 
            message: 'Image added successfully', 
            data: service 
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function editServiceData(req, res) {
    try {
        const { serviceID, category, subcategory } = req.body;

        if(!serviceID){
            return res.status(404).json({ success: false, message: "serviceID is required" });
        }
        
        if(!category && !subcategory){
            return res.status(404).json({ success: false, message: "category, subcategory is required" });
        }

        // Check if the service exists
        const service = await ServicesModel.findById(serviceID);
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        // Update category if provided
        if (category) {
            service.category = category;
        }

        // Update subcategory fields specifically if provided
        if (subcategory) {
            subcategory.forEach((sub, index) => {
                if (service.subcategory[index]) {
                    if (sub.title) service.subcategory[index].title = sub.title;
                    if (sub.pricing) service.subcategory[index].pricing = sub.pricing;
                } else {
                    service.subcategory.push(sub);
                }
            });
        }

        // Save the updated service document
        const updatedService = await service.save();

        return res.status(200).json({
            success: true,
            message: "Service updated successfully",
            data: updatedService,
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function editServiceSubCategory(req, res) {
    try {
        const { serviceID, subcategory } = req.body;
        const { _id, title, pricing } = subcategory;

        const service = await ServicesModel.findById(serviceID);
        if (!service) {
            return res.status(404).json({ success: false, message: "Service not found" });
        }

        if (!_id) {
            return res.status(400).json({ success: false, message: "Subcategory ID is required for updating" });
        }

        // Find the existing subcategory by _id
        const existingSubcategory = service.subcategory.id(_id);

        if (!existingSubcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found" });
        }

        // Update the existing subcategory fields
        existingSubcategory.title = title || existingSubcategory.title;
        existingSubcategory.pricing = pricing || existingSubcategory.pricing;

        // Save the updated service document
        await service.save();

        return res.status(200).json({ success: true, message: "Subcategory updated successfully", service });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function getCategory(req, res) {
    try {
        const { categoryId } = req.query;

        if(!categoryId){
            return res.status(404).json({ success: false, message: "categoryId is required"});
        }

        const category = await ServicesModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }
        return res.status(200).json({ success: true, data: category });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function getSubcategory(req, res) {
    try {
        const { categoryId, subcategoryId } = req.query;

        if(!categoryId || !subcategoryId){
            return res.status(404).json({ success: false, message: "categoryId, subcategoryId is required"});
        }

        const category = await ServicesModel.findById(categoryId);
        if (!category) {
            return res.status(404).json({ success: false, message: "Category not found" });
        }

        // Search for the subcategory within the category's subcategory array
        const subcategory = category.subcategory.id(subcategoryId);

        if (!subcategory) {
            return res.status(404).json({ success: false, message: "Subcategory not found" });
        }

        // Return the found subcategory
        return res.status(200).json({ success: true, data: subcategory });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: '+ error.message });
    }
}

export async function searchCategory(req, res) {
    try {
        const { service } = req.query;
        const categories = await ServicesModel.find({ category: { $regex: `^${service}`, $options: 'i' } });
        return res.status(200).json({ success: true, data: categories });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function searchSubCategoryInCategory(req, res) {
    try {
        const { category, subcategory } = req.query;

        // Validate the category parameter
        if (!category) {
            return res.status(400).json({ success: false, message: 'Category query parameter is required.' });
        }

        // Build the query dynamically
        const query = { category: { $regex: `^${category}`, $options: 'i' } };

        // Find the category with optional subcategory filtering
        const categories = await ServicesModel.find({ category: category });

        // If subcategory filtering is needed
        let filteredCategories = categories;

        if (subcategory) {
            filteredCategories = categories.map(cat => ({
                ...cat._doc,
                subcategory: cat.subcategory.filter(sub =>
                    sub.title.toLowerCase().includes(subcategory.toLowerCase())
                ),
            })).filter(cat => cat.subcategory.length > 0); // Exclude categories without matching subcategories
        }

        // Return response
        return res.status(200).json({ success: true, data: filteredCategories });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}

export async function searchSubCategoryInAllCategories(req, res) {
    try {
        const { subcategory } = req.query;

        // Build the projection to return only necessary fields
        const projection = {
            _id: 1,
            category: 1,
            'subcategory.title': 1,
            'subcategory.pricing': 1,
            'subcategory.dailyWageWorker': 1,
            'subcategory.hourlyWorker': 1,
            'subcategory.contractWorker': 1,
            'subcategory.image': 1,
        };

        // Fetch all categories
        const categories = await ServicesModel.find({}, projection);

        let filteredCategories = categories;

        // If subcategory filtering is needed
        if (subcategory) {
            filteredCategories = categories.map(cat => ({
                ...cat._doc,
                subcategory: cat.subcategory.filter(sub =>
                    sub.title.toLowerCase().includes(subcategory.toLowerCase())
                ),
            })).filter(cat => cat.subcategory.length > 0); // Exclude categories without matching subcategories
        }

        // Return response
        return res.status(200).json({ success: true, data: filteredCategories });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Internal Server Error: ' + error.message });
    }
}
