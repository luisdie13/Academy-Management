import express from 'express';
import { getDepartments, getMunicipalitiesByDepartment, getLocationHierarchy } from '../utils/guatemalaGeolocation.js';

const router = express.Router();

/**
 * GET /api/geolocation/departments
 * Get all departments in Guatemala
 */
router.get('/departments', (req, res) => {
  try {
    const departments = getDepartments();
    res.status(200).json({
      success: true,
      data: departments
    });
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch departments',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/geolocation/municipalities/:department
 * Get all municipalities for a given department
 */
router.get('/municipalities/:department', (req, res) => {
  try {
    const { department } = req.params;
    const municipalities = getMunicipalitiesByDepartment(department);
    
    if (!municipalities || municipalities.length === 0) {
      return res.status(404).json({
        error: {
          message: `Department "${department}" not found`,
          statusCode: 404,
          timestamp: new Date().toISOString()
        }
      });
    }

    res.status(200).json({
      success: true,
      department,
      data: municipalities
    });
  } catch (error) {
    console.error('Error fetching municipalities:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch municipalities',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/geolocation/hierarchy
 * Get complete department-municipality hierarchy
 * Useful for populating cascading dropdowns
 */
router.get('/hierarchy', (req, res) => {
  try {
    const hierarchy = getLocationHierarchy();
    res.status(200).json({
      success: true,
      data: hierarchy
    });
  } catch (error) {
    console.error('Error fetching location hierarchy:', error);
    res.status(500).json({
      error: {
        message: 'Failed to fetch location hierarchy',
        statusCode: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;
