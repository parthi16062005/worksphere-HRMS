from database import SessionLocal
from models import User


def make_admin():
    db = SessionLocal()

    try:
        user = db.query(User).filter(
            User.username == "parthi"
        ).first()

        if user is None:
            print("User not found. Check your username.")
            return

        user.role = "ADMIN"

        db.commit()
        db.refresh(user)

        print("Account role updated successfully!")
        print(f"Username: {user.username}")
        print(f"Email: {user.email}")
        print(f"Role: {user.role}")

    except Exception as error:
        db.rollback()
        print(f"Error updating role: {error}")

    finally:
        db.close()


if __name__ == "__main__":
    make_admin()