"""
Calculator module with basic mathematical operations
"""


def add(a: float, b: float) -> float:
    """
    Add two numbers.
    
    Args:
        a: First number
        b: Second number
        
    Returns:
        Sum of a and b
    """
    return a + b


def subtract(a: float, b: float) -> float:
    """
    Subtract second number from first number.
    
    Args:
        a: First number
        b: Second number
        
    Returns:
        Difference of a and b
    """
    return a - b


def multiply(a: float, b: float) -> float:
    """
    Multiply two numbers.
    
    Args:
        a: First number
        b: Second number
        
    Returns:
        Product of a and b
    """
    return a * b


def divide(a: float, b: float) -> float:
    """
    Divide first number by second number.
    
    Args:
        a: Dividend
        b: Divisor
        
    Returns:
        Quotient of a and b
        
    Raises:
        ValueError: If b is zero
    """
    if b == 0:
        raise ValueError("Cannot divide by zero!")
    return a / b


def power(base: float, exponent: float) -> float:
    """
    Raise base to the power of exponent.
    
    Args:
        base: The base number
        exponent: The exponent
        
    Returns:
        base raised to the power of exponent
    """
    return base ** exponent


if __name__ == "__main__":
    # Example usage
    print(f"10 + 5 = {add(10, 5)}")
    print(f"10 - 5 = {subtract(10, 5)}")
    print(f"10 * 5 = {multiply(10, 5)}")
    print(f"10 / 5 = {divide(10, 5)}")
    print(f"2 ^ 3 = {power(2, 3)}")

