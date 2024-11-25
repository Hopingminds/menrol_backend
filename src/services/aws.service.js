import aws from 'aws-sdk'
import multer from 'multer'
import multerS3 from 'multer-s3'
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables

aws.config.update({
    secretAccessKey: process.env.AWS_ACCESS_SECRET,
    accessKeyId: process.env.AWS_ACCESS_KEY,
    region: process.env.AWS_REGION,
});

const BUCKET = process.env.AWS_BUCKET;
if (!BUCKET) {
    throw new Error("AWS_BUCKET environment variable is not defined");
}

const s3 = new aws.S3();

export const uploadSubCategoryImage = multer({
    storage: multerS3({
        s3: s3,
        acl: "public-read",
        bucket: BUCKET,
        key: function (req, file, cb) {
            var newFileName = Date.now() + "-" + file.originalname;
            var fullPath = 'Services/SubCategoryImages/'+ newFileName;
            cb(null, fullPath);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE
    })
}); 

export const uploadServiceProviderImage = multer({
    storage: multerS3({
        s3: s3,
        acl: "public-read",
        bucket: BUCKET,
        key: function (req, file, cb) {
            var newFileName = Date.now() + "-" + file.originalname;
            var fullPath = 'ServiceProvider/ProfileImages/'+ newFileName;
            cb(null, fullPath);
        },
        contentType: multerS3.AUTO_CONTENT_TYPE
    })
});

export async function deleteFileFromAWS(filename) {
    if (!filename) {
        throw new Error("File name is required");
    }
    try {
        let fileKey = filename.split('.com/')[1].replaceAll(' ', '%20');
        fileKey = decodeURIComponent(fileKey);

        await s3.deleteObject({ Bucket: BUCKET, Key: fileKey }).promise();
        return true;
    } catch (error) {
        return false
    }
}
