-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `avatarUrl` TEXT NULL,
    `phone` VARCHAR(191) NULL,
    `role` ENUM('USER', 'ADMIN') NOT NULL DEFAULT 'USER',
    `travelStyle` ENUM('NATURE_ADVENTURE', 'BEACH_RELAXATION', 'CULTURE_HERITAGE', 'CULINARY_EXPLORER', 'PHOTOGRAPHY_SPOTS', 'FAMILY_FRIENDLY') NULL,
    `preferredRegion` ENUM('LOMBOK_SELATAN', 'LOMBOK_UTARA', 'LOMBOK_BARAT', 'LOMBOK_TIMUR', 'LOMBOK_TENGAH', 'GILI_ISLANDS') NULL,
    `isEmailVerified` BOOLEAN NOT NULL DEFAULT false,
    `refreshToken` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_email_idx`(`email`),
    INDEX `users_role_idx`(`role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `iconName` VARCHAR(191) NOT NULL,
    `coverImageUrl` TEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_slug_idx`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destinations` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `shortDescription` TEXT NOT NULL,
    `description` TEXT NOT NULL,
    `categoryId` VARCHAR(191) NOT NULL,
    `region` ENUM('LOMBOK_SELATAN', 'LOMBOK_UTARA', 'LOMBOK_BARAT', 'LOMBOK_TIMUR', 'LOMBOK_TENGAH', 'GILI_ISLANDS') NOT NULL,
    `locationName` VARCHAR(191) NOT NULL,
    `address` TEXT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `rating` DOUBLE NOT NULL DEFAULT 0.0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `entranceFee` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `openingHours` VARCHAR(191) NOT NULL,
    `estimatedDurationMinutes` INTEGER NOT NULL DEFAULT 60,
    `bestVisitingTime` VARCHAR(191) NOT NULL,
    `difficulty` ENUM('EASY', 'MODERATE', 'CHALLENGING', 'EXTREME') NOT NULL DEFAULT 'EASY',
    `tags` TEXT NOT NULL,
    `coverImageUrl` TEXT NOT NULL,
    `facilities` TEXT NOT NULL,
    `tips` TEXT NULL,
    `isFeatured` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `destinations_slug_key`(`slug`),
    INDEX `destinations_categoryId_idx`(`categoryId`),
    INDEX `destinations_region_idx`(`region`),
    INDEX `destinations_rating_idx`(`rating`),
    INDEX `destinations_isFeatured_idx`(`isFeatured`),
    INDEX `destinations_latitude_longitude_idx`(`latitude`, `longitude`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `destination_images` (
    `id` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NOT NULL,
    `imageUrl` TEXT NOT NULL,
    `caption` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `destination_images_destinationId_idx`(`destinationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorites_userId_idx`(`userId`),
    INDEX `favorites_destinationId_idx`(`destinationId`),
    UNIQUE INDEX `favorites_userId_destinationId_key`(`userId`, `destinationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reviews` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NOT NULL,
    `rating` DOUBLE NOT NULL,
    `content` TEXT NOT NULL,
    `photos` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `reviews_destinationId_idx`(`destinationId`),
    INDEX `reviews_userId_idx`(`userId`),
    INDEX `reviews_rating_idx`(`rating`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itineraries` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `coverImageUrl` TEXT NULL,
    `totalDays` INTEGER NOT NULL DEFAULT 1,
    `totalEstimatedBudget` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `travelStyle` ENUM('NATURE_ADVENTURE', 'BEACH_RELAXATION', 'CULTURE_HERITAGE', 'CULINARY_EXPLORER', 'PHOTOGRAPHY_SPOTS', 'FAMILY_FRIENDLY') NOT NULL DEFAULT 'BEACH_RELAXATION',
    `budgetLevel` ENUM('BUDGET', 'MID_RANGE', 'LUXURY') NOT NULL DEFAULT 'MID_RANGE',
    `pace` VARCHAR(191) NOT NULL DEFAULT 'BALANCED',
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `isSaved` BOOLEAN NOT NULL DEFAULT true,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `itineraries_userId_idx`(`userId`),
    INDEX `itineraries_travelStyle_idx`(`travelStyle`),
    INDEX `itineraries_budgetLevel_idx`(`budgetLevel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itinerary_days` (
    `id` VARCHAR(191) NOT NULL,
    `itineraryId` VARCHAR(191) NOT NULL,
    `dayNumber` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NULL,
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itinerary_days_itineraryId_idx`(`itineraryId`),
    UNIQUE INDEX `itinerary_days_itineraryId_dayNumber_key`(`itineraryId`, `dayNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `itinerary_items` (
    `id` VARCHAR(191) NOT NULL,
    `itineraryDayId` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NULL,
    `orderIndex` INTEGER NOT NULL,
    `timeSlot` VARCHAR(191) NULL,
    `customTitle` VARCHAR(191) NULL,
    `activityNotes` TEXT NULL,
    `estimatedDurationMinutes` INTEGER NOT NULL DEFAULT 60,
    `estimatedCost` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `itinerary_items_itineraryDayId_idx`(`itineraryDayId`),
    INDEX `itinerary_items_destinationId_idx`(`destinationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendations` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `subtitle` VARCHAR(191) NOT NULL,
    `bannerUrl` TEXT NOT NULL,
    `travelStyle` ENUM('NATURE_ADVENTURE', 'BEACH_RELAXATION', 'CULTURE_HERITAGE', 'CULINARY_EXPLORER', 'PHOTOGRAPHY_SPOTS', 'FAMILY_FRIENDLY') NOT NULL,
    `budgetLevel` ENUM('BUDGET', 'MID_RANGE', 'LUXURY') NOT NULL DEFAULT 'MID_RANGE',
    `recommendedDays` INTEGER NOT NULL DEFAULT 3,
    `estimatedBudget` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `recommendations_travelStyle_idx`(`travelStyle`),
    INDEX `recommendations_budgetLevel_idx`(`budgetLevel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `recommendation_destinations` (
    `id` VARCHAR(191) NOT NULL,
    `recommendationId` VARCHAR(191) NOT NULL,
    `destinationId` VARCHAR(191) NOT NULL,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,

    INDEX `recommendation_destinations_recommendationId_idx`(`recommendationId`),
    INDEX `recommendation_destinations_destinationId_idx`(`destinationId`),
    UNIQUE INDEX `recommendation_destinations_recommendationId_destinationId_key`(`recommendationId`, `destinationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `restaurants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `cuisineType` VARCHAR(191) NOT NULL,
    `specialtyDish` VARCHAR(191) NOT NULL,
    `priceRange` VARCHAR(191) NOT NULL,
    `minPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `maxPrice` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `rating` DOUBLE NOT NULL DEFAULT 0.0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `address` TEXT NOT NULL,
    `region` ENUM('LOMBOK_SELATAN', 'LOMBOK_UTARA', 'LOMBOK_BARAT', 'LOMBOK_TIMUR', 'LOMBOK_TENGAH', 'GILI_ISLANDS') NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `openingHours` VARCHAR(191) NOT NULL,
    `coverImageUrl` TEXT NOT NULL,
    `images` TEXT NOT NULL,
    `isHalalCertified` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `restaurants_slug_key`(`slug`),
    INDEX `restaurants_region_idx`(`region`),
    INDEX `restaurants_cuisineType_idx`(`cuisineType`),
    INDEX `restaurants_rating_idx`(`rating`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accommodations` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `rating` DOUBLE NOT NULL DEFAULT 0.0,
    `reviewCount` INTEGER NOT NULL DEFAULT 0,
    `pricePerNight` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `address` TEXT NOT NULL,
    `region` ENUM('LOMBOK_SELATAN', 'LOMBOK_UTARA', 'LOMBOK_BARAT', 'LOMBOK_TIMUR', 'LOMBOK_TENGAH', 'GILI_ISLANDS') NOT NULL,
    `latitude` DOUBLE NOT NULL,
    `longitude` DOUBLE NOT NULL,
    `coverImageUrl` TEXT NOT NULL,
    `images` TEXT NOT NULL,
    `amenities` TEXT NOT NULL,
    `contactPhone` VARCHAR(191) NULL,
    `websiteUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `accommodations_slug_key`(`slug`),
    INDEX `accommodations_region_idx`(`region`),
    INDEX `accommodations_type_idx`(`type`),
    INDEX `accommodations_pricePerNight_idx`(`pricePerNight`),
    INDEX `accommodations_rating_idx`(`rating`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `expenses` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `itineraryId` VARCHAR(191) NULL,
    `category` ENUM('TRANSPORT', 'FOOD', 'TICKET', 'LODGING', 'SOUVENIR', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `title` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'IDR',
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `notes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `expenses_userId_idx`(`userId`),
    INDEX `expenses_itineraryId_idx`(`itineraryId`),
    INDEX `expenses_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `travel_journals` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `content` TEXT NOT NULL,
    `locationName` VARCHAR(191) NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `photos` TEXT NULL,
    `isPublic` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `travel_journals_userId_idx`(`userId`),
    INDEX `travel_journals_date_idx`(`date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklists` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `category` ENUM('BEACH', 'TREKKING', 'GENERAL', 'CLOTHING', 'DOCUMENTS') NOT NULL DEFAULT 'GENERAL',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `checklists_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `checklist_items` (
    `id` VARCHAR(191) NOT NULL,
    `checklistId` VARCHAR(191) NOT NULL,
    `itemText` VARCHAR(191) NOT NULL,
    `isChecked` BOOLEAN NOT NULL DEFAULT false,
    `orderIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `checklist_items_checklistId_idx`(`checklistId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `weather_cache` (
    `id` VARCHAR(191) NOT NULL,
    `region` ENUM('LOMBOK_SELATAN', 'LOMBOK_UTARA', 'LOMBOK_BARAT', 'LOMBOK_TIMUR', 'LOMBOK_TENGAH', 'GILI_ISLANDS') NOT NULL,
    `locationName` VARCHAR(191) NOT NULL,
    `condition` VARCHAR(191) NOT NULL,
    `tempCelsius` INTEGER NOT NULL,
    `feelsLikeCelsius` INTEGER NOT NULL,
    `humidityPercent` INTEGER NOT NULL,
    `windSpeedKmh` DOUBLE NOT NULL,
    `uvIndex` INTEGER NOT NULL,
    `iconName` VARCHAR(191) NOT NULL,
    `recommendationTip` TEXT NOT NULL,
    `forecast` TEXT NOT NULL,
    `lastUpdated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `weather_cache_region_key`(`region`),
    INDEX `weather_cache_region_idx`(`region`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `destinations` ADD CONSTRAINT `destinations_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `destination_images` ADD CONSTRAINT `destination_images_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reviews` ADD CONSTRAINT `reviews_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itineraries` ADD CONSTRAINT `itineraries_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itinerary_days` ADD CONSTRAINT `itinerary_days_itineraryId_fkey` FOREIGN KEY (`itineraryId`) REFERENCES `itineraries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itinerary_items` ADD CONSTRAINT `itinerary_items_itineraryDayId_fkey` FOREIGN KEY (`itineraryDayId`) REFERENCES `itinerary_days`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `itinerary_items` ADD CONSTRAINT `itinerary_items_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `destinations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_destinations` ADD CONSTRAINT `recommendation_destinations_recommendationId_fkey` FOREIGN KEY (`recommendationId`) REFERENCES `recommendations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `recommendation_destinations` ADD CONSTRAINT `recommendation_destinations_destinationId_fkey` FOREIGN KEY (`destinationId`) REFERENCES `destinations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_itineraryId_fkey` FOREIGN KEY (`itineraryId`) REFERENCES `itineraries`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `travel_journals` ADD CONSTRAINT `travel_journals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklists` ADD CONSTRAINT `checklists_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `checklist_items` ADD CONSTRAINT `checklist_items_checklistId_fkey` FOREIGN KEY (`checklistId`) REFERENCES `checklists`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
