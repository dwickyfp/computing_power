import sys
import os
from unittest.mock import MagicMock, ANY

# Add current directory to path so we can import app modules
sys.path.append(os.getcwd())

from app.domain.services.destination import DestinationService
from app.domain.schemas.destination import DestinationCreate

def test_duplicate_destination():
    # Mock the database session
    mock_db = MagicMock()
    
    # Initialize service
    service = DestinationService(mock_db)
    
    # Mock the repository methods
    mock_dest = MagicMock()
    mock_dest.id = 1
    mock_dest.name = "prod-db"
    mock_dest.type = "POSTGRES"
    mock_dest.config = {"host": "localhost", "port": 5432}
    
    service.repository.get_by_id = MagicMock(return_value=mock_dest)
    
    # Mock create_destination to just return what passed in (wrapped in a mock)
    def side_effect_create(destination_data):
        created_mock = MagicMock()
        created_mock.id = 2
        created_mock.name = destination_data.name
        created_mock.type = destination_data.type
        created_mock.config = destination_data.config
        return created_mock
        
    service.create_destination = MagicMock(side_effect=side_effect_create)
    
    print("Attempting to call duplicate_destination...")
    try:
        new_dest = service.duplicate_destination(1)
        print(f"Success! New destination created: {new_dest.name}")
        print(f"New config: {new_dest.config}")
        
    except AttributeError as e:
        print(f"Caught expected error: {e}")
    except Exception as e:
        print(f"Caught unexpected error: {e}")

if __name__ == "__main__":
    test_duplicate_destination()
