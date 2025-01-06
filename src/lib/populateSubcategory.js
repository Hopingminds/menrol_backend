import ServicesModel from "../models/Services.model.js";

export async function populateSubcategoryInServiceProviderOrder(serviceOrder) {
    const servicesProvided = serviceOrder.servicesProvided;

    
    // Step 1: Fetch all unique service IDs from the services provided in the order
    const serviceIds = servicesProvided
        .filter(service => service.serviceId && service.serviceId._id)
        .map(service => service.serviceId._id);
    
    // Step 2: Fetch all subcategories for the services in one go
    const services = await ServicesModel.find({ '_id': { $in: serviceIds } }).select('subcategory _id');
    
    // Step 3: Build a lookup map for subcategories
    const subcategoryLookup = services.reduce((lookup, service) => {
        lookup[service._id.toString()] = service.subcategory;
        return lookup;
    }, {});

    // Step 4: Transform services provided to replace subcategories using the lookup map
    return servicesProvided.map(service => {
        if (service.serviceId && service.serviceId._id) {
            const categorySubcategories = subcategoryLookup[service.serviceId._id.toString()] || [];
        
            // Step 5: Replace subcategories with the matching ones from the lookup map
            const updatedSubcategories = service.subcategory.map(sub => {
                const matchingSubcategory = categorySubcategories.find(
                    s => s._id.toString() === sub.subcategoryId.toString()
                );
        
                // Use toObject() to convert Mongoose document to plain object
                const updatedSub = {
                    ...sub.toObject(), // Convert to plain object
                    subcategoryId: matchingSubcategory || sub.subcategoryId, // Keep original if no match
                };
                    
                return updatedSub;
            });
            
            // Return the service with updated subcategories
            return {
                ...service.toObject(), // Convert to plain object
                subcategory: updatedSubcategories,
            };
        }
        
        return service.toObject(); // Return the service as is, converted to plain object
    });
}

export async function populateSubcategoryInServiceOrder(serviceOrder) {
    const serviceRequests = serviceOrder.serviceRequest;

    // Step 1: Extract all unique service IDs
    const serviceIds = serviceRequests
        .filter(request => request.service._id)
        .map(request => request.service._id);

    // Step 2: Fetch all subcategories for the services in one go
    const services = await ServicesModel.find({ '_id': { $in: serviceIds } }).select('subcategory _id');

    // Step 3: Build a lookup map for subcategories
    const subcategoryLookup = services.reduce((lookup, service) => {
        lookup[service._id.toString()] = service.subcategory;
        return lookup;
    }, {});

    // Step 4: Transform service requests to replace subcategories using the lookup map
    return serviceRequests.map(request => {
        if (request.service) {
            const categorySubcategories = subcategoryLookup[request.service._id.toString()] || [];

            // Replace subcategory details
            const updatedSubcategories = request.subcategory.map(sub => {
                const matchingSubcategory = categorySubcategories.find(
                    s => s._id.toString() === sub.subcategoryId.toString()
                );

                // Convert to plain object and replace subcategoryId if a match is found
                const updatedSub = {
                    ...sub.toObject(), // Convert to plain object
                    subcategoryId: matchingSubcategory || sub.subcategoryId, // Keep original if no match
                };

                return updatedSub;
            });

            return {
                ...request.toObject(), // Convert to plain object
                subcategory: updatedSubcategories,
            };
        }

        return request.toObject(); // Return the request as is, converted to plain object
    });
}
