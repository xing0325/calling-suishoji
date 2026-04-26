CREATE TABLE `custom_categories` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `userId` int NOT NULL,
  `parentCategory` varchar(10) NOT NULL,
  `subCategory` varchar(100) NOT NULL,
  `label` varchar(100) NOT NULL,
  `icon` varchar(10) NOT NULL,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);
