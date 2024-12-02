from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from typing import List, Dict

class PortfolioGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.custom_style = ParagraphStyle(
            'CustomStyle',
            fontSize=12,
            leading=16,
            spaceAfter=30
        )

    async def generate_pdf(self, artworks: List[Dict], client_info: Dict) -> bytes:
        """Generate a custom PDF portfolio for a client."""
        # Create PDF buffer
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        story = []

        # Add header
        header_text = f"Art Portfolio for {client_info['name']}"
        story.append(Paragraph(header_text, self.styles['Title']))
        story.append(Spacer(1, 30))

        # Add artworks
        for artwork in artworks:
            # Artwork title
            title = f"{artwork['title']} by {artwork['artist']}"
            story.append(Paragraph(title, self.styles['Heading2']))

            # Artwork details
            details = f"""Medium: {artwork['medium']}
Dimensions: {artwork['dimensions']}
Year: {artwork['year']}
Price: {artwork['price']}"""
            story.append(Paragraph(details, self.custom_style))

            # Add image if available
            if artwork.get('image_url'):
                img = Image(artwork['image_url'])
                img.drawHeight = 300
                img.drawWidth = 400
                story.append(img)

            story.append(Spacer(1, 20))

        # Build PDF
        doc.build(story)
        buffer.seek(0)
        return buffer.getvalue()
