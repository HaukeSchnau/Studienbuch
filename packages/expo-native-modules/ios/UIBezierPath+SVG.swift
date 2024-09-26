import UIKit

extension UIBezierPath {
    
    // Helper to convert UIBezierPath into an SVG path string
    func toSVGPath() -> String {
        var svgPath = ""
        var firstPoint = true
        
        self.cgPath.applyWithBlock { elementPointer in
            let element = elementPointer.pointee
            let points = element.points
            
            switch element.type {
            case .moveToPoint:
                let x = points[0].x
                let y = points[0].y
                svgPath.append("M \(x) \(y) ")
                firstPoint = false
            case .addLineToPoint:
                let x = points[0].x
                let y = points[0].y
                svgPath.append("L \(x) \(y) ")
            case .addQuadCurveToPoint:
                let x1 = points[0].x
                let y1 = points[0].y
                let x2 = points[1].x
                let y2 = points[1].y
                svgPath.append("Q \(x1) \(y1), \(x2) \(y2) ")
            case .addCurveToPoint:
                let cp1X = points[0].x
                let cp1Y = points[0].y
                let cp2X = points[1].x
                let cp2Y = points[1].y
                let endX = points[2].x
                let endY = points[2].y
                svgPath.append("C \(cp1X) \(cp1Y), \(cp2X) \(cp2Y), \(endX) \(endY) ")
            case .closeSubpath:
                svgPath.append("Z ")
            default:
                break
            }
        }
        
        return svgPath.trimmingCharacters(in: .whitespaces)
    }
}
